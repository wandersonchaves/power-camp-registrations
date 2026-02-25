// src/use-cases/pix-auto/create-solicrec.use-case.ts
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

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
    select: { id: true, idRec: true },
  });
  if (!rec?.idRec) {
    throw new AppError(
      "Recurrence not ready (missing idRec)",
      409,
      "REC_NOT_READY",
    );
  }

  const d = input.destinatario;
  const dataExp = input.dataExpiracaoSolicitacaoISO;

  const idempotencyKey = sha256(
    [rec.idRec, d.cpf, d.agencia, d.conta, d.ispbParticipante, dataExp].join(
      "|",
    ),
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
      dataExpiracao: new Date(dataExp),
      agencia: d.agencia,
      conta: d.conta,
      cpf: d.cpf,
      ispb: d.ispbParticipante,
      inputPayload: asInputJson(input),
    },
  });

  const resp = await pixAutoClient.solicrec.create({
    idRec: rec.idRec,
    calendario: { dataExpiracaoSolicitacao: dataExp },
    destinatario: d,
  });

  return prisma.pixAutoSolicRec.update({
    where: { id: draft.id },
    data: {
      idSolicRec: resp.idSolicRec,
      status: String(resp.status ?? "CRIADA"),
      recPayload: resp.recPayload ?? undefined,
      payload: asInputJson(resp),
    },
  });
}
