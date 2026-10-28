// src/infra/team-installments/webhook-ingest.ts
import { getTeamInstallmentConfig } from "./config";

import { mapEfiPixItem } from "@/infra/efi/pix-received.mapper";

type RecordFn = ReturnType<
  typeof import("./container").getTeamInstallments
>["recordTeamPayment"];

// Carregamento tardio: o container puxa o cliente Efí (e a validação de env),
// que só é necessário quando a flag está ligada.
async function loadRecordTeamPayment() {
  return (await import("./container")).getTeamInstallments().recordTeamPayment;
}

/**
 * Registra no ledger os Pix de um webhook da Efí.
 * Nunca lança: falhas são logadas (sem dados pessoais) e o job de
 * reconciliação repara depois. Não pode afetar o ACK 200 do webhook.
 */
export async function recordTeamPaymentsFromWebhook(
  items: unknown[],
  record: () => Promise<RecordFn> | RecordFn = loadRecordTeamPayment,
) {
  try {
    if (!getTeamInstallmentConfig().enabled) return;
    const recordTeamPayment = await record();

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
