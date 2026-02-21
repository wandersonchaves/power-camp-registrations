// src/use-cases/enrollment/create-enrollment-and-start-journey3.use-case.ts
import type { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { waitForCobActive } from "@/infra/efi/wait-for-cob-active";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";
import { buildTxid } from "@/lib/txid";

type TeamCode = "AGUIA" | "LEAO";

type Input = {
  eventId: string;
  participantId: string;

  // opcional para LOTE_ZERO
  teamCode?: TeamCode | null;

  immediateAmount: string; // "20.83"
  recurringAmount: string; // "20.83"

  contrato: string;
  objeto?: string | null;

  periodicidade: "MENSAL" | "SEMANAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";
  dataInicial: string; // "YYYY-MM-DD"
  dataFinal?: string;

  solicitacaoPagador?: string;
};

type Output = {
  enrollmentId: string;
  txid: string;
  cobPixCopiaECola: string | null;
  idRec: string | null;
  recPixCopiaECola: string | null;
};

function assertEnv(name: string): string {
  const v = process.env[name] ?? "";
  if (!v) throw new Error(`${name} não definido.`);
  return v;
}

function isJsonObject(
  v: Prisma.JsonValue | null | undefined,
): v is Prisma.JsonObject {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function mapCobStatus(status: string) {
  const s = status.toUpperCase();

  if (
    s.includes("CONCLUID") ||
    s.includes("LIQ") ||
    s.includes("PAGA") ||
    s.includes("PAID")
  )
    return "PAID";
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s.includes("EXPIR")) return "EXPIRED";
  if (s.includes("ATIV")) return "ACTIVE"; // ATIVA
  return "CREATED";
}

/**
 * ✅ Jornada 3 (EFI) com idempotência e alta performance
 *
 * Regras:
 * - 1 Enrollment por (eventId, participantId)
 * - 1 Attempt por enrollment (enrollmentId é @unique)
 * - Se já existe attempt, NÃO chama PUT novamente (evita 400). Faz GET e retorna.
 * - Só cria REC depois que a COB estiver ATIVA (waitForCobActive).
 * - teamCode é opcional (LOTE_ZERO). O enrollment pode ficar com teamId = null.
 */
export async function createEnrollmentAndStartJourney3UseCase(
  input: Input,
): Promise<Output> {
  const pixKey = assertEnv("EFI_PIX_KEY");

  // 1) validações mínimas (queries enxutas)
  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
    select: { id: true, cpf: true, fullName: true },
  });
  if (!participant) {
    throw new AppError("Participant not found", 404, "PARTICIPANT_NOT_FOUND");
  }

  let teamId: string | null = null;
  if (input.teamCode) {
    const team = await prisma.team.findUnique({
      where: { code: input.teamCode },
      select: { id: true },
    });
    if (!team) throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");
    teamId = team.id;
  }

  // 2) enrollment idempotente (1 por participante/evento)
  const enrollment = await prisma.enrollment.upsert({
    where: {
      eventId_participantId: {
        eventId: input.eventId,
        participantId: input.participantId,
      },
    },
    update: {
      // permite trocar time enquanto PENDING (se você quiser)
      ...(teamId ? { teamId } : {}),
    },
    create: {
      eventId: input.eventId,
      participantId: input.participantId,
      teamId, // pode ser null no LOTE_ZERO
      status: "PENDING",
      reservedAt: new Date(),
    },
    select: { id: true, status: true },
  });

  // Se já confirmado, não inicia jornada novamente
  if (enrollment.status === "CONFIRMED") {
    return {
      enrollmentId: enrollment.id,
      txid: "",
      cobPixCopiaECola: null,
      idRec: null,
      recPixCopiaECola: null,
    };
  }

  // 3) idempotency key determinística (se mudar parâmetros do plano, muda a key)
  const paymentIdempotencyKey = sha256(
    [
      enrollment.id,
      input.immediateAmount,
      input.recurringAmount,
      input.periodicidade,
      input.dataInicial,
      input.dataFinal ?? "",
      input.contrato,
    ].join("|"),
  );

  // 4) txid determinístico do COB (idempotência real no endpoint PUT)
  const txid = buildTxid({
    eventId: input.eventId,
    kind: "COB_IMMEDIATE",
    enrollmentId: enrollment.id,
    participantId: input.participantId,
  });

  /**
   * 5) Idempotência forte (DB):
   * - O seu schema hoje tem enrollmentId como @unique em InitialPaymentAttempt.
   * - Então, se já existe um attempt para este enrollment, você deve REUTILIZAR a jornada.
   * - Isso evita P2002 e evita 400 no PUT /v2/cob/:txid.
   */
  const existingAttempt = await prisma.initialPaymentAttempt.findUnique({
    where: { enrollmentId: enrollment.id },
    select: { id: true, txid: true, idempotencyKey: true, payload: true },
  });

  if (existingAttempt?.txid) {
    // Reaproveita a COB (sem PUT de novo)
    const cobExisting = await pixAutoClient.cob.get(existingAttempt.txid);

    // Recorrência mais recente (se já criada)
    const rec = await prisma.pixAutoRecurrence.findFirst({
      where: { eventId: input.eventId, participantId: input.participantId },
      orderBy: { createdAt: "desc" },
      select: { idRec: true, pixCopiaECola: true },
    });

    // Tenta pegar copia-e-cola do COB do payload (se existir) — fallback pro GET
    let cobPix: string | null = null;
    if (isJsonObject(existingAttempt.payload)) {
      const cobPayload = (existingAttempt.payload as Prisma.JsonObject)["cob"];
      if (
        cobPayload &&
        typeof cobPayload === "object" &&
        !Array.isArray(cobPayload)
      ) {
        const maybePix = (cobPayload as Record<string, unknown>)[
          "pixCopiaECola"
        ];
        if (typeof maybePix === "string") cobPix = maybePix;
        if (maybePix === null) cobPix = null;
      }
    }
    cobPix = cobPix ?? cobExisting.pixCopiaECola ?? null;

    return {
      enrollmentId: enrollment.id,
      txid: existingAttempt.txid,
      cobPixCopiaECola: cobPix,
      idRec: rec?.idRec ?? null,
      recPixCopiaECola: rec?.pixCopiaECola ?? null,
    };
  }

  /**
   * 6) Criar/atualizar attempt de forma segura:
   * - Como enrollmentId é unique, usamos UPSERT por enrollmentId (evita P2002).
   * - E já gravamos txid + idempotencyKey atuais.
   * - payload sempre {} (nunca null).
   */
  const attempt = await prisma.initialPaymentAttempt.upsert({
    where: { enrollmentId: enrollment.id },
    update: {
      // Se existir attempt sem txid (ex: criado antes e crashou), fixamos
      ...(existingAttempt?.txid ? {} : { txid }),
      idempotencyKey: paymentIdempotencyKey,
      amount: input.immediateAmount,
      ...(existingAttempt?.payload ? {} : { payload: {} }),
    },
    create: {
      enrollmentId: enrollment.id,
      idempotencyKey: paymentIdempotencyKey,
      txid,
      status: "CREATED",
      amount: input.immediateAmount,
      payload: {}, // ✅ nunca null
    },
    select: { id: true, txid: true },
  });

  const effectiveTxid = attempt.txid ?? txid;

  // ==== Jornada 3 Efí ====
  // 7) locrec (QR da recorrência)
  const locrec = await pixAutoClient.locrec.create();

  /**
   * 8) COB via PUT /v2/cob/:txid (idempotência real no provedor)
   * IMPORTANTÍSSIMO:
   * - Só chame PUT quando você tem certeza que está criando (ou revisando permitido).
   * - Aqui nós estamos no caminho "não existia attempt.txid antes", então é ok.
   * - Se a EFI responder 400, o log do response.data vai te dizer o motivo.
   */
  let cob = await pixAutoClient.cob.put(effectiveTxid, {
    calendario: { expiracao: 3600 },
    valor: { original: input.immediateAmount },
    chave: pixKey,
    solicitacaoPagador:
      input.solicitacaoPagador ?? "PowerCamp 2027 - pagamento inicial",
    // devedor é opcional no COB. Se seu client suportar, pode habilitar:
    // devedor: { cpf: participant.cpf, nome: participant.fullName },
  });

  // garante ATIVA antes de criar REC (evita erro semântico de ativação)
  await waitForCobActive(effectiveTxid);

  // (opcional) Recarrega cob para garantir pixCopiaECola preenchido
  if (!cob.pixCopiaECola) {
    cob = await pixAutoClient.cob.get(effectiveTxid);
  }

  // 9) REC com ativacao txid + loc
  const rec = await pixAutoClient.rec.create({
    vinculo: {
      contrato: input.contrato,
      devedor: { cpf: participant.cpf, nome: participant.fullName },
      objeto: input.objeto ?? undefined,
    },
    calendario: {
      dataInicial: input.dataInicial,
      ...(input.dataFinal ? { dataFinal: input.dataFinal } : {}),
      periodicidade: input.periodicidade,
    },
    valor: { valorRec: input.recurringAmount },
    politicaRetentativa: "NAO_PERMITE",
    loc: locrec.id,
    ativacao: { dadosJornada: { txid: effectiveTxid } },
  });

  // 10) GET rec com txid para obter QR da jornada 3 (pode vir ou demorar)
  const recFull = await pixAutoClient.rec.get(rec.idRec, {
    txid: effectiveTxid,
  });

  // 11) persistência atômica
  await prisma.$transaction(async (tx) => {
    await tx.initialPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        txid: effectiveTxid,
        status: cob.status ? mapCobStatus(cob.status) : "CREATED",
        createdAtEfi: cob.calendario?.criacao
          ? new Date(cob.calendario.criacao)
          : null,
        payload: asInputJson({
          ticket: {
            immediateAmount: input.immediateAmount,
            recurringAmount: input.recurringAmount,
            periodicidade: input.periodicidade,
            dataInicial: input.dataInicial,
            dataFinal: input.dataFinal ?? null,
            contrato: input.contrato,
            objeto: input.objeto ?? null,
            teamCode: input.teamCode ?? null,
          },
          locrec,
          cob,
          rec,
          recGet: recFull,
        }),
      },
    });

    // idempotência da REC por enrollment + txid
    const recIdempotencyKey = sha256(
      ["REC", enrollment.id, effectiveTxid].join("|"),
    );

    await tx.pixAutoRecurrence.upsert({
      where: { idempotencyKey: recIdempotencyKey },
      update: {
        idRec: rec.idRec,
        status: recFull.status ?? rec.status ?? "CRIADA",
        locId: locrec.id,
        locationUrl: locrec.location,
        jornada: recFull.dadosQR?.jornada ?? null,
        pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
        valorRec: input.recurringAmount,
        periodicidade: input.periodicidade,
        dataInicial: new Date(`${input.dataInicial}T00:00:00.000Z`),
        dataFinal: input.dataFinal
          ? new Date(`${input.dataFinal}T00:00:00.000Z`)
          : null,
        contrato: input.contrato,
        objeto: input.objeto ?? null,
      },
      create: {
        idempotencyKey: recIdempotencyKey,
        eventId: input.eventId,
        participantId: input.participantId,
        idRec: rec.idRec,
        status: recFull.status ?? rec.status ?? "CRIADA",
        valorRec: input.recurringAmount,
        periodicidade: input.periodicidade,
        dataInicial: new Date(`${input.dataInicial}T00:00:00.000Z`),
        dataFinal: input.dataFinal
          ? new Date(`${input.dataFinal}T00:00:00.000Z`)
          : null,
        contrato: input.contrato,
        objeto: input.objeto ?? null,
        locId: locrec.id,
        locationUrl: locrec.location,
        jornada: recFull.dadosQR?.jornada ?? null,
        pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
      },
    });
  });

  log("info", "Enrollment journey3 started", {
    enrollmentId: enrollment.id,
    txid: effectiveTxid,
    idRec: rec.idRec,
  });

  return {
    enrollmentId: enrollment.id,
    txid: effectiveTxid,
    cobPixCopiaECola: cob.pixCopiaECola ?? null,
    idRec: rec.idRec,
    recPixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
  };
}
