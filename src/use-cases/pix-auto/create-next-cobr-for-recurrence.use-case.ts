import efiConfig from "@/config/efiConfig";
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

  // regra local: pelo menos 2 dias de antecedência (UTC) — mínimo exigido pela EFI
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

  // 1. Idempotência por (recurrenceId, competencia) - Já existe algo para este mês?
  const existingForMonth = await prisma.pixAutoCobr.findFirst({
    where: {
      recurrenceId: rec.id,
      competencia,
    },
  });

  // Se já existe e está em status terminal positivo, retorna
  if (
    existingForMonth &&
    ["ATIVA", "CONCLUIDA", "PAGO"].includes(existingForMonth.status)
  ) {
    return existingForMonth;
  }

  // 2. txid determinístico (estável) - se já existe um registro, reusamos o txid
  // Exceto se o status for falho ou expirado, nesse caso forçamos um novo para evitar "TXID em uso"
  const isFailed = !!(
    existingForMonth &&
    ["REJEITADA", "FALHA", "ERRO", "EXPIRADA"].includes(existingForMonth.status)
  );

  const txid: string =
    existingForMonth && !isFailed
      ? (existingForMonth.txid ?? "")
      : buildTxid({
          eventId,
          kind: "COBR_RECURRING",
          recurrenceIdRec: rec.idRec,
          // Se falhou, usamos um timestamp para garantir que o buildTxid gere algo diferente
          dueDate: isFailed ? `${dueDate}-${new Date().getTime()}` : dueDate,
        });

  // Se já existe no banco, verificamos se a data original ainda é válida (D+2)
  // Se não for, usamos a nova 'dueDate' calculada pelo batch
  let finalDueDate = dueDate;
  if (existingForMonth) {
    const originalDate = existingForMonth.dataVencimento
      .toISOString()
      .split("T")[0];
    if (diffDaysUTC(originalDate) >= 2) {
      finalDueDate = originalDate;
    }
  }

  // Trava de segurança: Garante que o vencimento não pule para o próximo mês
  // se a competência desejada for o mês atual.
  const targetMonth = competencia.slice(5, 7);
  const dueMonth = finalDueDate.slice(5, 7);
  if (dueMonth !== targetMonth) {
    const year = parseInt(competencia.slice(0, 4));
    const month = parseInt(targetMonth);
    const lastDay = new Date(year, month, 0).getDate();
    finalDueDate = `${year}-${targetMonth.padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
  }

  // 3. Define a idempotencyKey
  const idempotencyKey =
    existingForMonth?.idempotencyKey ||
    sha256(
      ["COBR_NEXT_V6", rec.id, competencia, txid, finalDueDate, amount].join(
        "|",
      ),
    );

  const draft = await prisma.pixAutoCobr.upsert({
    where: { idempotencyKey },
    update: {
      status: "CREATING",
      dataVencimento: new Date(`${finalDueDate}T00:00:00.000Z`),
    },
    create: {
      idempotencyKey,
      recurrenceId: rec.id,
      txid,
      competencia,
      status: "CREATING",
      dataVencimento: new Date(`${finalDueDate}T00:00:00.000Z`),
      valorOriginal: amount,
      infoAdicional: input.infoAdicional ?? null,
      ajusteDiaUtil: input.ajusteDiaUtil ?? true,
    },
  });

  // Prepara o body conforme o schema estrito da Efí para cobranças recorrentes
  // Nota: Devedor em /v2/cobr (recorrência) não aceita cpf/nome, pois já estão no idRec.
  // Recebedor é obrigatório para este endpoint.
  const putBody: CreateCobrRequest = {
    idRec: rec.idRec,
    calendario: { dataDeVencimento: finalDueDate },
    valor: {
      original: amount,
    },
    infoAdicional: input.infoAdicional || undefined,
    ajusteDiaUtil: input.ajusteDiaUtil ?? true,
    recebedor: {
      agencia: input.recebedor?.agencia ?? efiConfig.recebedor.agencia,
      conta: input.recebedor?.conta ?? efiConfig.recebedor.conta,
      tipoConta: input.recebedor?.tipoConta ?? efiConfig.recebedor.tipoConta,
    },
  };

  // Se houver dados adicionais de endereço no input, mescla-os
  if (input.devedor) {
    putBody.devedor = {
      ...input.devedor,
    };
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
