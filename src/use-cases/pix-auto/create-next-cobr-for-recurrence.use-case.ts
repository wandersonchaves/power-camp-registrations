import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { AppError } from "@/lib/http-errors";
import { toPrismaJsonNullableInput } from "@/lib/json";
import { prisma } from "@/lib/prisma";
import { buildTxid } from "@/lib/txid";

type Input = {
  eventId: string;
  recurrenceId: string; // ID interno
  dueDate: string; // YYYY-MM-DD
  amount: string; // "106.07"

  recebedor: {
    conta: string;
    tipoConta: "CORRENTE" | "POUPANCA" | "PAGAMENTO";
    agencia?: string;
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

export async function createNextCobrForRecurrenceUseCase(input: Input) {
  const rec = await prisma.pixAutoRecurrence.findUnique({
    where: { id: input.recurrenceId },
  });
  if (!rec?.idRec)
    throw new AppError("Recurrence not ready", 409, "REC_NOT_READY");

  // (mínimo) valida “2 dias de antecedência”
  const today = new Date();
  const due = new Date(input.dueDate + "T00:00:00Z");
  const diffDays = Math.floor(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 2)
    throw new AppError(
      "dueDate must be at least 2 days ahead",
      400,
      "INVALID_DUE_DATE",
    );

  const txid = buildTxid({
    eventId: input.eventId,
    kind: "COBR_RECURRING",
    recurrenceIdRec: rec.idRec,
    dueDate: input.dueDate,
  });

  // idempotência local por txid
  const existing = await prisma.pixAutoCobr.findFirst({ where: { txid } });
  if (existing) return existing;

  const resp = await pixAutoClient.cobr.put(txid, {
    idRec: rec.idRec,
    infoAdicional: input.infoAdicional,
    calendario: { dataDeVencimento: input.dueDate },
    valor: { original: input.amount },
    ajusteDiaUtil: input.ajusteDiaUtil ?? true,
    devedor: input.devedor,
    recebedor: input.recebedor,
  });

  return prisma.pixAutoCobr.create({
    data: {
      recurrenceId: rec.id,
      txid: resp.txid,
      status: resp.status ?? "CRIADA",
      dataVencimento: new Date(input.dueDate),
      valorOriginal: input.amount,
      infoAdicional: input.infoAdicional ?? null,
      ajusteDiaUtil: input.ajusteDiaUtil ?? true,
      politicaRetentativa: resp.politicaRetentativa ?? null,
      idempotencyKey: txid, // simples: txid como idempotencyKey
      payload: toPrismaJsonNullableInput(resp),
    },
  });
}
