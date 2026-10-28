// src/use-cases/team-installments/reconcile-team-payments.use-case.ts
import type { ReceivedPixSource } from "./ports";
import type {
  RecordTeamPaymentInput,
  RecordTeamPaymentResult,
} from "./record-team-payment.use-case";

import { isExactMultiple } from "@/domain/team-installments/money";

export interface ReconcileReport {
  scanned: number;
  candidates: number;
  created: number;
  existing: number;
  failed: number;
}

const MAX_PAGES = 200; // trava de segurança contra paginação defeituosa

/**
 * Rede de segurança do webhook: varre os Pix recebidos na janela e registra
 * (idempotentemente) os que são múltiplos exatos da parcela.
 * Falha em um item não interrompe os demais.
 */
export function makeReconcileTeamPayments(deps: {
  source: ReceivedPixSource;
  recordTeamPayment: (
    input: RecordTeamPaymentInput,
  ) => Promise<RecordTeamPaymentResult>;
  installmentAmountCents: number;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());

  return async function reconcileTeamPayments(params: {
    days: number;
  }): Promise<ReconcileReport> {
    const to = now();
    const from = new Date(to.getTime() - params.days * 24 * 60 * 60 * 1000);
    const report: ReconcileReport = {
      scanned: 0,
      candidates: 0,
      created: 0,
      existing: 0,
      failed: 0,
    };

    let page = 0;
    let totalPages = 1;
    while (page < totalPages && page < MAX_PAGES) {
      const result = await deps.source.fetchPage({ from, to, page });
      totalPages = result.totalPages;
      page += 1;

      for (const pix of result.items) {
        report.scanned += 1;
        if (!isExactMultiple(pix.amountCents, deps.installmentAmountCents)) {
          continue;
        }
        report.candidates += 1;

        try {
          const r = await deps.recordTeamPayment({
            ...pix,
            source: "RECONCILIATION",
          });
          if (r.outcome === "CREATED") report.created += 1;
          else report.existing += 1;
        } catch {
          report.failed += 1;
        }
      }
    }

    return report;
  };
}
