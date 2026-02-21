// src/lib/txid.ts
import { sha256 } from "@/lib/crypto";

type TxidContext = {
  eventId: string;
  kind: "COB_IMMEDIATE" | "COBR_RECURRING";
  enrollmentId?: string;
  participantId?: string;
  recurrenceIdRec?: string; // idRec Efí
  dueDate?: string; // YYYY-MM-DD (para cobr)
  installmentIndex?: number;
};

/**
 * TXID determinístico:
 * - 32 chars (hex) => dentro do range 26..35
 * - alfanum (0-9 a-f)
 */
export function buildTxid(ctx: TxidContext) {
  const raw = [
    ctx.eventId,
    ctx.kind,
    ctx.enrollmentId ?? "",
    ctx.participantId ?? "",
    ctx.recurrenceIdRec ?? "",
    ctx.dueDate ?? "",
    ctx.installmentIndex?.toString() ?? "",
  ].join("|");

  return sha256(raw).slice(0, 32);
}
