import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";

type Input = {
  eventId: string;
  participantId: string;

  contrato: string;
  objeto?: string;

  dataInicial: string; // YYYY-MM-DD
  dataFinal?: string; // YYYY-MM-DD
  periodicidade: string;
  valorRec: string;

  // Jornada 2/3/4: se você já tiver locrec
  locId?: number;

  // Jornada 3/4: se precisar atrelar txid de cobrança imediata/cobv
  ativacaoTxid?: string;
};

export async function createRecurrenceUseCase(input: Input) {
  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
  });
  if (!participant)
    throw new AppError("Participant not found", 404, "PARTICIPANT_NOT_FOUND");

  const idempotencyKey = sha256(
    [
      input.eventId,
      input.participantId,
      participant.cpf,
      input.contrato,
      input.dataInicial,
      input.dataFinal ?? "",
      input.periodicidade,
      input.valorRec,
      input.locId ?? "",
      input.ativacaoTxid ?? "",
    ].join("|"),
  );

  const existing = await prisma.pixAutoRecurrence.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.idRec) return existing;

  const body = {
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
    valor: { valorRec: input.valorRec },
    ...(input.locId ? { loc: input.locId } : {}),
    ...(input.ativacaoTxid
      ? { ativacao: { dadosJornada: { txid: input.ativacaoTxid } } }
      : {}),
  };

  // cria placeholder (evita race)
  const draft = await prisma.pixAutoRecurrence.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      idempotencyKey,
      eventId: input.eventId,
      participantId: input.participantId,
      status: "CREATING",
      valorRec: input.valorRec,
      periodicidade: input.periodicidade,
      dataInicial: new Date(input.dataInicial),
      dataFinal: input.dataFinal ? new Date(input.dataFinal) : null,
      contrato: input.contrato,
      objeto: input.objeto,
      locId: input.locId ?? null,
      jornada: null,
      locationUrl: null,
      pixCopiaECola: null,
    },
  });

  const resp = await pixAutoClient.rec.create(body);

  // opcional: buscar QR “copia e cola” depois do create (Jornada 2/3/4)
  const full = await pixAutoClient.rec.get(resp.idRec);

  const updated = await prisma.pixAutoRecurrence.update({
    where: { id: draft.id },
    data: {
      idRec: resp.idRec,
      status: full.status ?? resp.status ?? "CRIADA",
      locId: full.loc?.id ?? draft.locId,
      locationUrl: full.loc?.location ?? draft.locationUrl,
      jornada: full.dadosQR?.jornada ?? draft.jornada,
      pixCopiaECola: full.dadosQR?.pixCopiaECola ?? draft.pixCopiaECola,
    },
  });

  return updated;
}
