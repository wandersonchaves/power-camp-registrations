import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import type {
  CobrResponse,
  CreateCobrRequest,
} from "@/infra/efi/pix-auto.types";
import { buildTxid } from "@/infra/efi/txid";
import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Input = {
  eventId: string;
  recurrenceId: string; // ID interno
  dueDate: string; // YYYY-MM-DD
  amount: string; // "106.07"

  recebedor?: {
    agencia?: string;
    conta?: string;
    tipoConta?: string;
  };
  infoAdicional?: string;
  ajusteDiaUtil?: boolean;

  devedor?: {
    email?: string;
    logradouro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
};

function assertDateYYYYMMDD(v: string, field: string) {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new AppError(`${field} must be YYYY-MM-DD`, 400, "INVALID_DATE");
  }
  return s;
}

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

function diffDaysUTC(dateYYYYMMDD: string) {
  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const due = new Date(`${dateYYYYMMDD}T00:00:00.000Z`).getTime();
  return Math.floor((due - todayUTC) / (1000 * 60 * 60 * 24));
}

export async function createNextCobrForRecurrenceUseCase(input: Input) {
  const eventId = String(input.eventId ?? "").trim();
  const recurrenceId = String(input.recurrenceId ?? "").trim();
  if (!eventId)
    throw new AppError("eventId is required", 400, "EVENT_ID_REQUIRED");
  if (!recurrenceId)
    throw new AppError(
      "recurrenceId is required",
      400,
      "RECURRENCE_ID_REQUIRED",
    );

  const dueDate = assertDateYYYYMMDD(input.dueDate, "dueDate");
  const amount = normalizeMoney(input.amount);

  const rec = await prisma.pixAutoRecurrence.findUnique({
    where: { id: recurrenceId },
    select: {
      id: true,
      idRec: true,
      participant: { select: { cpf: true, fullName: true } },
    },
  });
  if (!rec?.idRec)
    throw new AppError("Recurrence not ready", 409, "REC_NOT_READY");

  // regra local: pelo menos 2 dias de antecedência (UTC) — evita erro bobo
  const d = diffDaysUTC(dueDate);
  if (d < 2) {
    throw new AppError(
      "dueDate must be at least 2 days ahead",
      400,
      "INVALID_DUE_DATE",
      { dueDate, diffDays: d },
    );
  }

  // competencia baseada no vencimento (YYYY-MM)
  const competencia = dueDate.slice(0, 7);

  // txid determinístico (estável)
  const txid = buildTxid({
    eventId,
    kind: "COBR_RECURRING",
    recurrenceIdRec: rec.idRec,
    dueDate,
  });

  // 1. Idempotência por (recurrenceId, competencia) - Já existe algo resolvido?
  const existingActive = await prisma.pixAutoCobr.findFirst({
    where: {
      recurrenceId: rec.id,
      competencia,
      status: { in: ["ATIVA", "CONCLUIDA", "PAGO"] },
    },
  });
  if (existingActive) return existingActive;

  // 2. Busca se já existe um registro com este txid (mesmo que falho ou incompleto)
  // Isso evita o erro de "Unique constraint failed on (txid)"
  const existingByTxid = await prisma.pixAutoCobr.findUnique({
    where: { txid },
  });

  // 3. Define a idempotencyKey: se já existe o txid, usamos a dele, senão geramos a nova
  const idempotencyKey =
    existingByTxid?.idempotencyKey ||
    sha256(
      ["COBR_NEXT_V5", rec.id, competencia, txid, dueDate, amount].join("|"),
    );

  const draft = await prisma.pixAutoCobr.upsert({
    where: { idempotencyKey },
    update: {
      status: "CREATING",
    },
    create: {
      idempotencyKey,
      recurrenceId: rec.id,
      txid,
      competencia,
      status: "CREATING",
      dataVencimento: new Date(`${dueDate}T00:00:00.000Z`),
      valorOriginal: amount,
      infoAdicional: input.infoAdicional ?? null,
      ajusteDiaUtil: input.ajusteDiaUtil ?? true,
    },
  });

  // Prepara o body conforme o schema estrito da Efí para cobranças recorrentes
  // NOTA: O devedor NÃO deve ser enviado com CPF/Nome aqui, pois já está no idRec.
  const putBody: CreateCobrRequest = {
    idRec: rec.idRec,
    calendario: { dataDeVencimento: dueDate },
    valor: { original: amount },
    infoAdicional: input.infoAdicional || undefined,
  };

  // Opcional: só adiciona recebedor se houver dados reais
  if (input.recebedor && input.recebedor.conta) {
    putBody.recebedor = input.recebedor;
  }

  // Opcional: só adiciona devedor se houver dados de ENDEREÇO (conforme schema da Efí)
  if (input.devedor && Object.keys(input.devedor).length > 0) {
    putBody.devedor = input.devedor;
  }

  const resp = await pixAutoClient.cobr.put(txid, putBody);

  const cobrResp = resp as CobrResponse;

  return prisma.pixAutoCobr.update({
    where: { id: draft.id },
    data: {
      txid: String(cobrResp.txid ?? txid).trim(),
      status: String(cobrResp.status ?? "CRIADA"),
      politicaRetentativa: cobrResp.politicaRetentativa ?? null,
      payload: asInputJson(cobrResp),
    },
  });
}
