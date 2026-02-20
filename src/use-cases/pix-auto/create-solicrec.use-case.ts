import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";

type Input = {
  recurrenceId: string;
  dataExpiracaoSolicitacaoISO: string; // ISO datetime
  destinatario: {
    agencia: string;
    conta: string;
    cpf: string;
    ispbParticipante: string;
  };
};

export async function createSolicRecUseCase(input: Input) {
  const rec = await prisma.pixAutoRecurrence.findUnique({
    where: { id: input.recurrenceId },
  });
  if (!rec?.idRec)
    throw new AppError(
      "Recurrence not ready (missing idRec)",
      409,
      "REC_NOT_READY",
    );

  const idempotencyKey = sha256(
    [
      rec.idRec,
      input.destinatario.cpf,
      input.destinatario.agencia,
      input.destinatario.conta,
      input.destinatario.ispbParticipante,
      input.dataExpiracaoSolicitacaoISO,
    ].join("|"),
  );

  const existing = await prisma.pixAutoSolicRec.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.idSolicRec) return existing;

  const draft = await prisma.pixAutoSolicRec.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      idempotencyKey,
      recurrenceId: rec.id,
      status: "CREATING",
      dataExpiracao: new Date(input.dataExpiracaoSolicitacaoISO),
      agencia: input.destinatario.agencia,
      conta: input.destinatario.conta,
      cpf: input.destinatario.cpf,
      ispb: input.destinatario.ispbParticipante,
    },
  });

  const resp = await pixAutoClient.solicrec.create({
    idRec: rec.idRec,
    calendario: { dataExpiracaoSolicitacao: input.dataExpiracaoSolicitacaoISO },
    destinatario: input.destinatario,
  });

  const updated = await prisma.pixAutoSolicRec.update({
    where: { id: draft.id },
    data: {
      idSolicRec: resp.idSolicRec,
      status: resp.status ?? "CRIADA",
      recPayload: resp.recPayload ?? undefined,
    },
  });

  return updated;
}
