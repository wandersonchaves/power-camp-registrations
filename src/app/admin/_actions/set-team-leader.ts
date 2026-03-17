"use server";

import { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { requireAdmin } from "@/lib/auth/guards";
import { sha256 } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

function toYYYYMMDDUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMonthsUTC(base: Date, months: number) {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function makeUniqueContratoEfi(params: {
  enrollmentId: string;
  participantId: string;
  eventId: string;
}): string {
  const timestamp = Date.now().toString();
  const seed = `${params.eventId}|${params.participantId}|${params.enrollmentId}|${timestamp}`;
  const h = sha256(seed);
  const onlyDigits = h.replace(/\D/g, "");
  return onlyDigits.slice(-8).padStart(8, "8");
}

export async function setTeamLeaderAction(enrollmentId: string) {
  await requireAdmin();

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { participant: true, team: true },
  });

  if (!enrollment || !enrollment.team) {
    throw new Error("Inscrição ou equipe não encontrada.");
  }

  try {
    // 1. Invalidar líderes anteriores no banco
    await prisma.pixAutoRecurrence.updateMany({
      where: {
        eventId: enrollment.eventId,
        participant: { enrollments: { some: { teamId: enrollment.teamId } } },
        status: { in: ["CRIADA", "ATIVA", "APROVADA"] },
      },
      data: { status: "CANCELADA_TROCA_LIDER" },
    });

    // 2. JORNADA 2 - PASSO 1: Criar o Location (Obrigatório para gerar QR Code)
    const locrec = await pixAutoClient.locrec.create();

    // 2. Parâmetros financeiros (933.30)
    const teamRecurringAmount = (18.3 * 51).toFixed(2);
    const dataInicial = toYYYYMMDDUTC(addMonthsUTC(new Date(), 1));
    const contrato = makeUniqueContratoEfi({
      enrollmentId: enrollment.id,
      participantId: enrollment.participantId,
      eventId: enrollment.eventId,
    });

    // 4. JORNADA 2 - PASSO 2: Criar a Recorrência informando o location
    const recBody = {
      vinculo: {
        contrato,
        devedor: {
          cpf: enrollment.participant.cpf.replace(/\D/g, ""),
          nome: enrollment.participant.fullName,
        },
        objeto: `PowerCamp Equipe ${enrollment.team.name}`,
      },
      calendario: { dataInicial, periodicidade: "MENSAL" as const },
      valor: { valorRec: teamRecurringAmount },
      politicaRetentativa: "NAO_PERMITE" as const,
      loc: locrec.id, // VINCULA O LOCATION AQUI
    };

    const efiRec = await pixAutoClient.rec.create(recBody);

    // 5. JORNADA 2 - PASSO 3: Consultar a recorrência para obter o copia e cola
    let efiRecFull: Prisma.JsonObject | null = null;
    let pixCopiaECola: string | undefined = undefined;

    for (let i = 0; i < 5; i++) {
      try {
        const res = await pixAutoClient.rec.get(efiRec.idRec);
        efiRecFull = res as unknown as Prisma.JsonObject;
        // Na J2, o pixCopiaECola geralmente vem no root ou dadosQR
        pixCopiaECola =
          (efiRecFull.pixCopiaECola as string | undefined) ||
          ((efiRecFull.dadosQR as Prisma.JsonObject | undefined)
            ?.pixCopiaECola as string | undefined);
        if (pixCopiaECola) break;
      } catch {
        console.warn("[setTeamLeaderAction] Retry fetching J2 QR code...", i);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 6. Salvar no Banco
    const recIdempotencyKey = sha256(
      ["REC_LDR", enrollment.id, contrato].join("|"),
    );

    await prisma.pixAutoRecurrence.create({
      data: {
        idempotencyKey: recIdempotencyKey,
        eventId: enrollment.eventId,
        participantId: enrollment.participantId,
        idRec: efiRec.idRec,
        status: (efiRecFull?.status as string) || "CRIADA",
        valorRec: teamRecurringAmount,
        periodicidade: "MENSAL",
        dataInicial: new Date(`${dataInicial}T00:00:00.000Z`),
        contrato,
        objeto: `PowerCamp Equipe ${enrollment.team.name}`,
        jornada: "JORNADA_2",
        pixCopiaECola: pixCopiaECola || null,
        locId: locrec.id,
        locationUrl: locrec.location,
        payload: (efiRecFull ||
          (efiRec as unknown as Prisma.JsonObject)) as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      url: `/enroll/success?enrollmentId=${enrollmentId}`,
    };
  } catch (err: unknown) {
    console.error("[setTeamLeaderAction] J2 Error:", err);
    let detail = "Erro desconhecido";

    if (err instanceof Error) {
      detail = err.message;
    }

    // Tenta extrair detalhes específicos de erro de rede/API
    if (typeof err === "object" && err !== null && "response" in err) {
      const response = (
        err as { response: { data?: { mensagem?: string; detail?: string } } }
      ).response;
      if (response.data) {
        detail = response.data.mensagem || response.data.detail || detail;
      }
    }

    throw new Error(`Erro na Efí: ${detail}`);
  }
}
