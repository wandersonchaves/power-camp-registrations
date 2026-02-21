import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { toPrismaJsonNullableInput } from "@/lib/json";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { buildTxid } from "@/lib/txid";

type Input = {
  eventId: string;
  participantId: string;
  teamCode: "AGUIA" | "LEAO";

  immediateAmount: string; // "106.07"
  recurringAmount: string; // "106.07"

  contrato: string;
  objeto?: string;
  periodicidade: string; // "MENSAL"
  dataInicial: string; // "2027-02-01"
  dataFinal?: string;

  solicitacaoPagador?: string;
};

export async function createEnrollmentAndStartJourney3UseCase(input: Input) {
  // time
  const team = await prisma.team.findUnique({
    where: { code: input.teamCode },
  });
  if (!team) throw new AppError("Team not found", 404, "TEAM_NOT_FOUND");

  // participante
  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
  });
  if (!participant)
    throw new AppError("Participant not found", 404, "PARTICIPANT_NOT_FOUND");

  // idempotency do enrollment (1 por participante/evento)
  const enrollment = await prisma.enrollment.upsert({
    where: {
      eventId_participantId: {
        eventId: input.eventId,
        participantId: input.participantId,
      },
    },
    update: {
      teamId: team.id, // se quiser permitir trocar time enquanto PENDING, ok
    },
    create: {
      eventId: input.eventId,
      participantId: input.participantId,
      teamId: team.id,
      status: "PENDING",
    },
    include: { initialPayment: true },
  });

  if (enrollment.status === "CONFIRMED") {
    return { enrollment, message: "Already confirmed" };
  }

  const paymentIdempotencyKey = sha256(
    [
      enrollment.id,
      input.immediateAmount,
      input.contrato,
      input.dataInicial,
      input.periodicidade,
      input.recurringAmount,
    ].join("|"),
  );

  const txid = buildTxid({
    eventId: input.eventId,
    kind: "COB_IMMEDIATE",
    enrollmentId: enrollment.id,
    participantId: input.participantId,
  });

  const attempt = await prisma.initialPaymentAttempt.upsert({
    where: { idempotencyKey: paymentIdempotencyKey },
    update: {},
    create: {
      enrollmentId: enrollment.id,
      idempotencyKey: paymentIdempotencyKey,
      txid,
      status: "CREATED",
      amount: input.immediateAmount,
    },
  });

  // ==== Jornada 3 Efí ====
  // 1) locrec
  const loc = await pixAutoClient.locrec.create({});

  // 2) cob imediata - RECOMENDO PUT /v2/cob/:txid para idempotência real (mesmo txid)
  const cob = await pixAutoClient.cob.put(txid, {
    valor: { original: input.immediateAmount },
    solicitacaoPagador:
      input.solicitacaoPagador ?? `PowerCamp 2027 - pagamento inicial`,
  });

  // 3) rec (loc + ativacao txid)
  const rec = await pixAutoClient.rec.create({
    vinculo: {
      contrato: input.contrato,
      devedor: { cpf: participant.cpf, nome: participant.fullName },
      objeto: input.objeto,
    },
    calendario: {
      dataInicial: input.dataInicial,
      dataFinal: input.dataFinal,
      periodicidade: input.periodicidade,
    },
    valor: { valorRec: input.recurringAmount },
    loc: loc.id,
    ativacao: { dadosJornada: { txid } },
  });

  // 4) GET rec com txid para copia e cola (Jornada 3)
  const recFull = await pixAutoClient.rec.get(rec.idRec, { txid });

  // Persistência do resultado da jornada
  await prisma.$transaction(async (tx) => {
    await tx.initialPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        txid,
        status: cob.status ? mapCobStatus(cob.status) : "CREATED",
        createdAtEfi: cob.calendario?.criacao
          ? new Date(cob.calendario.criacao)
          : null,
        payload: toPrismaJsonNullableInput(cob),
      },
    });

    await tx.pixAutoRecurrence.upsert({
      where: {
        idempotencyKey: sha256(["REC", enrollment.id, txid].join("|")),
      },
      update: {
        idRec: rec.idRec,
        status: recFull.status ?? rec.status ?? "CRIADA",
        locId: loc.id,
        locationUrl: loc.location,
        jornada: recFull.dadosQR?.jornada ?? "JORNADA_3",
        pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
        valorRec: input.recurringAmount,
        periodicidade: input.periodicidade,
        dataInicial: new Date(input.dataInicial),
        dataFinal: input.dataFinal ? new Date(input.dataFinal) : null,
        contrato: input.contrato,
        objeto: input.objeto ?? null,
      },
      create: {
        idempotencyKey: sha256(["REC", enrollment.id, txid].join("|")),
        eventId: input.eventId,
        participantId: input.participantId,
        idRec: rec.idRec,
        status: recFull.status ?? rec.status ?? "CRIADA",
        valorRec: input.recurringAmount,
        periodicidade: input.periodicidade,
        dataInicial: new Date(input.dataInicial),
        dataFinal: input.dataFinal ? new Date(input.dataFinal) : null,
        contrato: input.contrato,
        objeto: input.objeto ?? null,
        locId: loc.id,
        locationUrl: loc.location,
        jornada: recFull.dadosQR?.jornada ?? "JORNADA_3",
        pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
      },
    });
  });

  log("info", "Enrollment journey3 started", {
    enrollmentId: enrollment.id,
    txid,
    idRec: rec.idRec,
  });

  return {
    enrollmentId: enrollment.id,
    txid,
    idRec: rec.idRec,
    pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
  };
}

// Mapeamento básico (ajuste conforme status reais do /v2/cob)
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
  return "ACTIVE";
}
