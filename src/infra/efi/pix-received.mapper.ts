// src/infra/efi/pix-received.mapper.ts
import { parseReaisToCents } from "@/domain/team-installments/money";

/** Pix recebido, normalizado a partir do payload da Efí (webhook ou GET /v2/pix). */
export interface ReceivedPix {
  endToEndId: string;
  txid: string | null;
  amountCents: number;
  paidAt: Date;
  payerName: string | null;
  payerDocument: string | null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Parsing defensivo de um item Pix da Efí. Retorna null se faltar o mínimo
 * para o ledger (e2eId, valor válido e horário válido).
 * Nome/documento do pagador só vêm quando a conta habilita `gnExtras.pagador`.
 */
export function mapEfiPixItem(item: unknown): ReceivedPix | null {
  const raw = obj(item);
  if (!raw) return null;

  const endToEndId = str(raw.endToEndId);
  const amountCents = parseReaisToCents(str(raw.valor));
  const horario = str(raw.horario);
  const paidAt = horario ? new Date(horario) : null;

  if (
    !endToEndId ||
    !amountCents ||
    !paidAt ||
    Number.isNaN(paidAt.getTime())
  ) {
    return null;
  }

  const pagador = obj(obj(raw.gnExtras)?.pagador);

  return {
    endToEndId,
    txid: str(raw.txid),
    amountCents,
    paidAt,
    payerName: str(pagador?.nome),
    payerDocument: str(pagador?.cpf) ?? str(pagador?.cnpj),
  };
}
