"use server";

import { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { buildTxid } from "@/infra/efi/txid";
import { waitForCobActive } from "@/infra/efi/wait-for-cob-active";
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

async function waitCobActivatableForRec(txid: string, budgetMs: number) {
  await waitForCobActive(txid, {
    label: "[ADMIN] wait-cob-leader-activation",
    maxTotalMs: budgetMs,
    maxAttempts: 10,
    baseDelayMs: 500,
    maxDelayMs: 2_500,
    multiplier: 1.5,
    jitterMs: 200,
    dedupeTtlMs: 10_000,
    getCacheTtlMs: 1_000,
    minCobAgeMs: 1_500,
    requireConsecutiveActiveReads: 1,
    acceptPaidAsUsable: false,
  });
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

  const pixKey = process.env.EFI_PIX_KEY;
  if (!pixKey) throw new Error("Chave PIX da Efí não configurada.");

  try {
    // 1. Invalidar líderes anteriores
    await prisma.pixAutoRecurrence.updateMany({
      where: {
        eventId: enrollment.eventId,
        participant: { enrollments: { some: { teamId: enrollment.teamId } } },
        status: { in: ["CRIADA", "ATIVA", "APROVADA"] },
      },
      data: { status: "CANCELADA_TROCA_LIDER" },
    });

    const teamRecurringAmount = (18.3 * 51).toFixed(2);
    const dataInicialRecorrencia = toYYYYMMDDUTC(addMonthsUTC(new Date(), 1));
    const contrato = makeUniqueContratoEfi({
      enrollmentId: enrollment.id,
      participantId: enrollment.participantId,
      eventId: enrollment.eventId,
    });

    // 2. JORNADA 3 - PASSO 1: Location
    const locrec = await pixAutoClient.locrec.create();

    // 3. JORNADA 3 - PASSO 2: Cobrança Imediata (Mês 1)
    const txidAtivacao = buildTxid({
      eventId: "J3",
      kind: "COB_IMMEDIATE",
      enrollmentId: contrato,
      participantId: enrollment.participant.cpf,
      installmentIndex: 88, // Prefixo especial de líder
    });

    const cobAtivacao = await pixAutoClient.cob.put(txidAtivacao, {
      calendario: { expiracao: 3600 },
      devedor: {
        cpf: enrollment.participant.cpf.replace(/\D/g, ""),
        nome: enrollment.participant.fullName,
      },
      valor: { original: teamRecurringAmount },
      chave: pixKey,
      solicitacaoPagador: `Ativação Coletiva: Mês 1 - Equipe ${enrollment.team.name}`,
    });

    // Aguarda ativação da cobrança
    await waitCobActivatableForRec(txidAtivacao, 12_000);

    // 4. JORNADA 3 - PASSO 3: Recorrência vinculada ao txid
    const recBody = {
      vinculo: {
        contrato,
        devedor: {
          cpf: enrollment.participant.cpf.replace(/\D/g, ""),
          nome: enrollment.participant.fullName,
        },
        objeto: `PowerCamp Equipe ${enrollment.team.name}`,
      },
      calendario: {
        dataInicial: dataInicialRecorrencia,
        periodicidade: "MENSAL" as const,
      },
      valor: { valorRec: teamRecurringAmount },
      politicaRetentativa: "PERMITE_3R_7D" as const,
      loc: locrec.id,
      ativacao: { dadosJornada: { txid: txidAtivacao } },
    };

    const efiRec = await pixAutoClient.rec.create(recBody);

    // 5. JORNADA 3 - PASSO 4: Consultar com query param txid
    let efiRecFull: Prisma.JsonObject | null = null;
    let pixCopiaECola: string | undefined = undefined;

    for (let i = 0; i < 5; i++) {
      try {
        const res = await pixAutoClient.rec.get(efiRec.idRec, {
          txid: txidAtivacao,
        });
        efiRecFull = res as unknown as Prisma.JsonObject;
        pixCopiaECola = (efiRecFull.dadosQR as Prisma.JsonObject | undefined)
          ?.pixCopiaECola as string | undefined;
        if (pixCopiaECola) break;
      } catch {
        console.warn("[setTeamLeaderAction] Retry fetching J3 QR code...", i);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!pixCopiaECola) {
      pixCopiaECola = cobAtivacao.pixCopiaECola;
    }

    // 6. Salvar
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
        dataInicial: new Date(`${dataInicialRecorrencia}T00:00:00.000Z`),
        contrato,
        objeto: `PowerCamp Equipe ${enrollment.team.name}`,
        jornada: "JORNADA_3",
        pixCopiaECola: pixCopiaECola || null,
        locId: locrec.id,
        locationUrl: locrec.location,
        firstCobTxid: txidAtivacao,
        payload: (efiRecFull ||
          (efiRec as unknown as Prisma.JsonObject)) as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      url: `/enroll/success?enrollmentId=${enrollmentId}`,
    };
  } catch (err: unknown) {
    console.error("[setTeamLeaderAction] J3 Error:", err);
    let detail = "Erro desconhecido";
    if (err instanceof Error) detail = err.message;
    if (typeof err === "object" && err !== null && "response" in err) {
      const response = (
        err as { response: { data?: { mensagem?: string; detail?: string } } }
      ).response;
      if (response.data)
        detail = response.data.mensagem || response.data.detail || detail;
    }
    throw new Error(`Erro na Efí: ${detail}`);
  }
}
