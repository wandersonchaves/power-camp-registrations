// src/infra/efi/txid.ts
import { customAlphabet } from "nanoid";

import { sha256 } from "@/lib/crypto";

export type TxidContext = {
  eventId: string;
  kind: "COB_IMMEDIATE" | "COBR_RECURRING";
  enrollmentId?: string;
  participantId?: string;
  recurrenceIdRec?: string; // idRec Efí
  dueDate?: string; // YYYY-MM-DD (para cobr)
  installmentIndex?: number;
};

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 32);

/**
 * Efí/Pix: TXID alfanumérico, 26..35 caracteres.
 */
export function assertValidTxid(txid: string) {
  const v = String(txid ?? "").trim();
  const ok = /^[A-Za-z0-9]{26,35}$/.test(v);
  if (!ok) {
    throw new Error(
      `TXID inválido: "${v}". Esperado: alfanumérico (A-Z a-z 0-9) e tamanho 26..35.`,
    );
  }
  return v;
}

/**
 * TXID random (32 chars) - seguro e compatível.
 */
export function generateTxid(): string {
  const txid = nanoid();
  // garante compat
  assertValidTxid(txid);
  return txid;
}

/**
 * TXID determinístico:
 * - 32 chars hex (0-9a-f) => alfanum + 32 => dentro de 26..35
 * - útil para idempotência (quando você controla o txid via PUT /cob/:txid em fluxos não-"puro")
 */
export function buildTxid(ctx: TxidContext): string {
  const raw = [
    ctx.eventId,
    ctx.kind,
    ctx.enrollmentId ?? "",
    ctx.participantId ?? "",
    ctx.recurrenceIdRec ?? "",
    ctx.dueDate ?? "",
    ctx.installmentIndex?.toString() ?? "",
  ].join("|");

  const txid = sha256(raw).slice(0, 32);
  assertValidTxid(txid);
  return txid;
}
