import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Input = {
  recurrenceId: string;

  dataDeVencimento: string; // YYYY-MM-DD
  valorOriginal: string;
  infoAdicional?: string;
  ajusteDiaUtil?: boolean;

  // opcional: quando você quer controlar txid (PUT)
  txid?: string;

  devedor?: {
    cep?: string;
    cidade?: string;
    email?: string;
    logradouro?: string;
    uf?: string;
  };

  recebedor?: {
    agencia?: string;
    conta?: string;
    tipoConta?: string;
  };
};

export async function createCobrUseCase(input: Input) {
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
      input.txid ?? "POST",
      input.dataDeVencimento,
      input.valorOriginal,
      input.ajusteDiaUtil ? "1" : "0",
    ].join("|"),
  );

  const existing = await prisma.pixAutoCobr.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.txid) return existing;

  const draft = await prisma.pixAutoCobr.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      idempotencyKey,
      recurrenceId: rec.id,
      status: "CREATING",
      dataVencimento: new Date(input.dataDeVencimento),
      valorOriginal: input.valorOriginal,
      infoAdicional: input.infoAdicional ?? null,
      ajusteDiaUtil: input.ajusteDiaUtil ?? false,
    },
  });

  const body = {
    idRec: rec.idRec,
    infoAdicional: input.infoAdicional,
    calendario: { dataDeVencimento: input.dataDeVencimento },
    valor: { original: input.valorOriginal },
    ajusteDiaUtil: input.ajusteDiaUtil ?? false,
    devedor: input.devedor,
    recebedor: input.recebedor,
  };

  const resp = input.txid
    ? await pixAutoClient.cobr.put(input.txid, body)
    : await pixAutoClient.cobr.create(body);

  const updated = await prisma.pixAutoCobr.update({
    where: { id: draft.id },
    data: {
      txid: resp.txid,
      status: resp.status ?? "CRIADA",
      politicaRetentativa: resp.politicaRetentativa ?? null,
      payload: asInputJson(resp),
    },
  });

  return updated;
}
