// src/infra/team-installments/webhook-ingest.ts
import { getTeamInstallmentConfig } from "./config";
import { getTeamInstallments } from "./container";

import { mapEfiPixItem } from "@/infra/efi/pix-received.mapper";

/**
 * Registra no ledger os Pix de um webhook da Efí.
 * Nunca lança: falhas são logadas (sem dados pessoais) e o job de
 * reconciliação repara depois. Não pode afetar o ACK 200 do webhook.
 */
export async function recordTeamPaymentsFromWebhook(
  items: unknown[],
  record = () => getTeamInstallments().recordTeamPayment,
) {
  try {
    if (!getTeamInstallmentConfig().enabled) return;
    const recordTeamPayment = record();

    for (const item of items) {
      try {
        const pix = mapEfiPixItem(item);
        if (!pix) continue;
        await recordTeamPayment({ ...pix, source: "WEBHOOK" });
      } catch (err) {
        console.error(
          "[EFI webhook pix] team ledger failed (job will repair)",
          {
            msg: err instanceof Error ? err.message : "unknown_error",
          },
        );
      }
    }
  } catch (err) {
    console.error("[EFI webhook pix] team ledger disabled by error", {
      msg: err instanceof Error ? err.message : "unknown_error",
    });
  }
}
