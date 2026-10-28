// src/use-cases/team-installments/import-team-payments.use-case.ts
import type { ParsedPaymentRow, TeamCodeValue } from "./parse-payments-csv";
import type {
  RecordTeamPaymentInput,
  RecordTeamPaymentResult,
} from "./record-team-payment.use-case";

import { isExactMultiple } from "@/domain/team-installments/money";
import { sha256 } from "@/lib/crypto";

export type ImportAction = "CREATE" | "CREATE_IGNORED" | "EXISTS" | "ERROR";

export interface ImportRowReport {
  line: number;
  endToEndId: string;
  action: ImportAction;
  teamCode: TeamCodeValue | null;
  amountCents: number;
  /** Só com apply: resultado real do registro. */
  outcome?: RecordTeamPaymentResult["outcome"];
  error?: string;
}

/**
 * Linhas sem e2eId recebem chave determinística (conteúdo da linha), para que
 * reimportar o mesmo CSV não duplique lançamentos MANUAL.
 */
export function stableKeyFor(row: ParsedPaymentRow): string {
  const digest = sha256(
    [
      row.paidAt.toISOString(),
      row.amountCents,
      row.teamCode ?? "",
      row.payerName ?? "",
    ].join("|"),
  ).slice(0, 24);
  return `MANUAL-IMPORT-${digest}`;
}

export function makeImportTeamPayments(deps: {
  recordTeamPayment: (
    input: RecordTeamPaymentInput,
  ) => Promise<RecordTeamPaymentResult>;
  paymentExists: (endToEndId: string) => Promise<boolean>;
  teamIdByCode: Record<TeamCodeValue, string>;
  installmentAmountCents: number;
}) {
  return async function importTeamPayments(params: {
    rows: ParsedPaymentRow[];
    apply: boolean;
    userEmail?: string | null;
  }): Promise<ImportRowReport[]> {
    const reports: ImportRowReport[] = [];

    for (const row of params.rows) {
      const endToEndId = row.endToEndId ?? stableKeyFor(row);
      const base = {
        line: row.line,
        endToEndId,
        teamCode: row.teamCode,
        amountCents: row.amountCents,
      };

      try {
        const exists = await deps.paymentExists(endToEndId);
        const multiple = isExactMultiple(
          row.amountCents,
          deps.installmentAmountCents,
        );
        const action: ImportAction = exists
          ? "EXISTS"
          : multiple
            ? "CREATE"
            : "CREATE_IGNORED";

        if (!params.apply) {
          reports.push({ ...base, action });
          continue;
        }

        const result = await deps.recordTeamPayment({
          endToEndId,
          txid: row.txid,
          amountCents: row.amountCents,
          paidAt: row.paidAt,
          payerName: row.payerName,
          source: row.source,
          confirmation: row.confirmation,
          teamId: row.teamCode ? deps.teamIdByCode[row.teamCode] : null,
          attributionReason: row.reason ?? "importação CSV",
          note: row.note,
          userEmail: params.userEmail ?? null,
        });
        reports.push({ ...base, action, outcome: result.outcome });
      } catch (err) {
        reports.push({
          ...base,
          action: "ERROR",
          error: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }
    return reports;
  };
}
