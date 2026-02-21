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

  // 32 chars hex => 32 (entre 26 e 35) e alfanumérico.
  return sha256(raw).slice(0, 32);
}
