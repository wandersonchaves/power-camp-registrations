// src/use-cases/team-installments/register-efi-payments.use-case.ts
import type {
  CobPayerLookup,
  ReceivedPixSource,
  TeamInstallmentReadModel,
} from "./ports";
import type { makePromotePayment } from "./promote-payment.use-case";
import type {
  RecordTeamPaymentInput,
  RecordTeamPaymentResult,
} from "./record-team-payment.use-case";

export interface EfiActionResult {
  endToEndId: string;
  ok: boolean;
  message: string;
}

/**
 * Registra Pix escolhidos pelo admin. Os dados (valor, data, pagador) vêm de uma
 * nova consulta autoritativa à Efí — nunca do que o navegador enviou.
 */
export function makeRegisterEfiPayments(deps: {
  source: ReceivedPixSource;
  cobPayers: CobPayerLookup;
  recordTeamPayment: (
    input: RecordTeamPaymentInput,
  ) => Promise<RecordTeamPaymentResult>;
}) {
  return async function registerEfiPayments(params: {
    picks: { endToEndId: string; teamId: string | null }[];
    userEmail: string | null;
  }): Promise<EfiActionResult[]> {
    const results: EfiActionResult[] = [];

    for (const pick of params.picks) {
      try {
        const pix = await deps.source.fetchByEndToEndId(pick.endToEndId);
        if (!pix) {
          results.push({
            endToEndId: pick.endToEndId,
            ok: false,
            message: "não encontrado na Efí",
          });
          continue;
        }

        let { payerName, payerDocument } = pix;
        if (!payerName && pix.txid) {
          const payer = await deps.cobPayers.findPayer(pix.txid);
          payerName = payer?.name ?? null;
          payerDocument = payer?.document ?? payerDocument;
        }

        const r = await deps.recordTeamPayment({
          endToEndId: pix.endToEndId,
          txid: pix.txid,
          amountCents: pix.amountCents,
          paidAt: pix.paidAt,
          payerName,
          payerDocument,
          source: "RECONCILIATION",
          confirmation: "CONFIRMED",
          teamId: pick.teamId,
          attributionReason: "confirmado na Efí; equipe escolhida por admin",
          userEmail: params.userEmail,
        });
        results.push({
          endToEndId: pick.endToEndId,
          ok: true,
          message:
            r.outcome === "EXISTING" ? "já estava registrado" : "registrado",
        });
      } catch (err) {
        results.push({
          endToEndId: pick.endToEndId,
          ok: false,
          message: err instanceof Error ? err.message : "falha ao registrar",
        });
      }
    }
    return results;
  };
}

/** Confirma um lançamento manual com o Pix real, exigindo o mesmo valor. */
export function makeConfirmManualWithEfi(deps: {
  source: ReceivedPixSource;
  readModel: TeamInstallmentReadModel;
  promotePayment: ReturnType<typeof makePromotePayment>;
}) {
  return async function confirmManualWithEfi(params: {
    paymentId: string;
    endToEndId: string;
    userEmail: string | null;
  }) {
    const [manual, pix] = await Promise.all([
      deps.readModel.getPayment(params.paymentId),
      deps.source.fetchByEndToEndId(params.endToEndId),
    ]);
    if (!pix) throw new Error("Pix não encontrado na Efí");
    if (!manual || manual.source !== "MANUAL") {
      throw new Error("Lançamento manual não encontrado");
    }
    if (manual.amountCents !== pix.amountCents) {
      throw new Error("O valor do Pix na Efí é diferente do lançamento manual");
    }

    return deps.promotePayment({
      paymentId: params.paymentId,
      realEndToEndId: pix.endToEndId,
      txid: pix.txid,
      userEmail: params.userEmail,
    });
  };
}
