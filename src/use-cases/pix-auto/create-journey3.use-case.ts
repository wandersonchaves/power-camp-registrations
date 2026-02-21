import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { toPrismaJsonNullableInput } from "@/lib/json";
import { prisma } from "@/lib/prisma";

type Input = {
  eventId: string;
  participantId: string;

  // cobrança imediata (primeiro pagamento)
  immediateAmount: string; // "106.07"
  // se você quiser controlar o txid do cob imediato via PUT, passe aqui
  immediateTxid?: string;

  // recorrência
  contrato: string;
  objeto?: string;
  periodicidade: string; // "MENSAL"
  dataInicial: string; // "2027-02-01" (exemplo)
  dataFinal?: string;
  valorRec: string;

  // opcional (se quiser mandar campos extras do cob)
  solicitacaoPagador?: string;
};

export async function createJourney3UseCase(input: Input) {
  const participant = await prisma.participant.findUnique({
    where: { id: input.participantId },
  });
  if (!participant)
    throw new AppError("Participant not found", 404, "PARTICIPANT_NOT_FOUND");

  // Idempotência do fluxo Jornada 3 (evita duplicar tudo)
  const idempotencyKey = sha256(
    [
      input.eventId,
      input.participantId,
      participant.cpf,
      input.immediateAmount,
      input.immediateTxid ?? "POST",
      input.contrato,
      input.dataInicial,
      input.dataFinal ?? "",
      input.periodicidade,
      input.valorRec,
    ].join("|"),
  );

  // Se já existe recorrência com esta chave, retorna
  const existingRec = await prisma.pixAutoRecurrence.findUnique({
    where: { idempotencyKey },
  });
  if (existingRec?.idRec) return existingRec;

  // 1) locrec
  const loc = await pixAutoClient.locrec.create({});

  await prisma.pixAutoLocRec.upsert({
    where: { locId: loc.id },
    update: {},
    create: {
      eventId: input.eventId,
      participantId: input.participantId,
      locId: loc.id,
      locationUrl: loc.location,
      criacao: loc.criacao ? new Date(loc.criacao) : null,
    },
  });

  // 2) cob imediata (POST /v2/cob ou PUT /v2/cob/:txid)
  const cobBody = {
    valor: { original: input.immediateAmount },
    solicitacaoPagador:
      input.solicitacaoPagador ?? `PowerCamp 2027 - 1ª mensalidade`,
  };

  const cob = input.immediateTxid
    ? await pixAutoClient.cob.put(input.immediateTxid, cobBody)
    : await pixAutoClient.cob.create(cobBody);

  // persistir “cob imediata” (opcional, mas recomendado)
  const cobIdempotencyKey = sha256(
    [input.eventId, input.participantId, cob.txid].join("|"),
  );
  await prisma.pixCobImmediate.upsert({
    where: { idempotencyKey: cobIdempotencyKey },
    update: {
      txid: cob.txid,
      status: cob.status ?? "CRIADA",
      payload: toPrismaJsonNullableInput(cob),
    },
    create: {
      eventId: input.eventId,
      participantId: input.participantId,
      idempotencyKey: cobIdempotencyKey,
      txid: cob.txid,
      status: cob.status ?? "CRIADA",
      valorOriginal: input.immediateAmount,
      criadoEm: cob.calendario?.criacao
        ? new Date(cob.calendario.criacao)
        : null,
      payload: toPrismaJsonNullableInput(cob),
    },
  });

  // 3) rec (informar loc + txid da cob imediata na ativação)
  const recDraft = await prisma.pixAutoRecurrence.create({
    data: {
      idempotencyKey,
      eventId: input.eventId,
      participantId: input.participantId,
      status: "CREATING",
      valorRec: input.valorRec,
      periodicidade: input.periodicidade,
      dataInicial: new Date(input.dataInicial),
      dataFinal: input.dataFinal ? new Date(input.dataFinal) : null,
      contrato: input.contrato,
      objeto: input.objeto ?? null,
      locId: loc.id,
      locationUrl: loc.location,
      jornada: "JORNADA_3",
    },
  });

  const recResp = await pixAutoClient.rec.create({
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
    loc: loc.id,
    ativacao: { dadosJornada: { txid: cob.txid } },
  });

  // 4) consultar recorrência informando txid (pra obter copia e cola)
  const recFull = await pixAutoClient.rec.get(recResp.idRec, {
    txid: cob.txid,
  });

  const updated = await prisma.pixAutoRecurrence.update({
    where: { id: recDraft.id },
    data: {
      idRec: recResp.idRec,
      status: recFull.status ?? recResp.status ?? "CRIADA",
      pixCopiaECola: recFull.dadosQR?.pixCopiaECola ?? null,
      jornada: recFull.dadosQR?.jornada ?? "JORNADA_3",
    },
  });

  return updated;
}
