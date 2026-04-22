// src/use-cases/pix-auto/create-cobr.use-case.ts
import efiConfig from "@/config/efiConfig";
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import type { CobrResponse } from "@/infra/efi/pix-auto.types";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Input = {
  recurrenceId: string;

  dataDeVencimento: string; // YYYY-MM-DD
  valorOriginal: string; // "106.07"
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

function normalizeMoney(value: string): string {
  const raw = String(value ?? "")
    .trim()
    .replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError("Invalid amount", 400, "INVALID_AMOUNT");
  }
  return n.toFixed(2);
}

function assertDateYYYYMMDD(v: string, field: string) {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new AppError(`${field} must be YYYY-MM-DD`, 400, "INVALID_DATE");
  }
  return s;
}

function normalizeTxidOptional(txid?: string) {
  const t = String(txid ?? "").trim();
  return t || undefined;
}

export async function createCobrUseCase(input: Input) {
  const recurrenceId = String(input.recurrenceId ?? "").trim();
  if (!recurrenceId)
    throw new AppError(
      "recurrenceId is required",
      400,
      "RECURRENCE_ID_REQUIRED",
    );

  const dataDeVencimento = assertDateYYYYMMDD(
    input.dataDeVencimento,
    "dataDeVencimento",
  );
  const valorOriginal = normalizeMoney(input.valorOriginal);
  const txid = normalizeTxidOptional(input.txid);

  const rec = await prisma.pixAutoRecurrence.findUnique({
    where: { id: recurrenceId },
    select: { id: true, idRec: true },
  });
  if (!rec?.idRec) {
    throw new AppError(
      "Recurrence not ready (missing idRec)",
      409,
      "REC_NOT_READY",
    );
  }

  // Idempotência: mesmo input => mesma key.
  // - Se txid definido, idempotência por txid (preferível)
  // - Se não, por composição de dados + "POST"
  const idempotencyKey = sha256(
    [
      "COBR",
      rec.idRec,
      txid ?? "POST",
      dataDeVencimento,
      valorOriginal,
      input.ajusteDiaUtil ? "1" : "0",
      input.infoAdicional ?? "",
      input.devedor?.email ?? "",
      input.recebedor?.conta ?? "",
      input.recebedor?.tipoConta ?? "",
    ].join("|"),
  );

  const existing = await prisma.pixAutoCobr.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.txid) return existing;

  // Draft (evita race)
  const draft = await prisma.pixAutoCobr.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      idempotencyKey,
      recurrenceId: rec.id,
      status: "CREATING",
      dataVencimento: new Date(`${dataDeVencimento}T00:00:00.000Z`),
      valorOriginal,
      infoAdicional: input.infoAdicional ?? null,
      ajusteDiaUtil: input.ajusteDiaUtil ?? false,
    },
  });

  const body = {
    idRec: rec.idRec,
    infoAdicional: input.infoAdicional,
    calendario: { dataDeVencimento },
    valor: { original: valorOriginal },
    ajusteDiaUtil: input.ajusteDiaUtil ?? false,
    devedor: input.devedor,
    recebedor: {
      agencia: input.recebedor?.agencia ?? efiConfig.recebedor.agencia,
      conta: input.recebedor?.conta ?? efiConfig.recebedor.conta,
      tipoConta: input.recebedor?.tipoConta ?? efiConfig.recebedor.tipoConta,
    },
  };

  // PUT /v2/cobr/:txid (controlado) OU POST /v2/cobr (PSP gera txid)
  const resp = txid
    ? await pixAutoClient.cobr.put(txid, body)
    : await pixAutoClient.cobr.create(body);

  const cobrResp = resp as CobrResponse;

  const updated = await prisma.pixAutoCobr.update({
    where: { id: draft.id },
    data: {
      txid: String(cobrResp.txid ?? txid ?? "").trim(),
      status: String(cobrResp.status ?? "CRIADA"),
      politicaRetentativa: cobrResp.politicaRetentativa ?? null,
      payload: asInputJson(cobrResp),
    },
  });

  return updated;
}
