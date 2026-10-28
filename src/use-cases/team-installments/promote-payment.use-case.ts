// src/use-cases/team-installments/promote-payment.use-case.ts
import type { TeamLedgerUnitOfWork } from "./ports";
import { reallocateTeam } from "./reallocate-team";

export interface PromotePaymentInput {
  paymentId: string;
  realEndToEndId: string;
  txid?: string | null;
  userEmail?: string | null;
}

/**
 * Promove um lançamento MANUAL/UNCONFIRMED a CONFIRMED quando o e2eId real chega.
 * - Se o e2eId real ainda não existe: apenas troca a chave sintética.
 * - Se já existe (webhook/job chegou antes): funde no registro real e remove o manual.
 * Em ambos os casos a alocação é recalculada, sem duplicar parcelas.
 */
export function makePromotePayment(deps: {
  uow: TeamLedgerUnitOfWork;
  installmentAmountCents: number;
}) {
  return async function promotePayment(input: PromotePaymentInput) {
    return deps.uow.run(async (ledger) => {
      const manual = await ledger.findById(input.paymentId);
      if (
        !manual ||
        manual.source !== "MANUAL" ||
        manual.confirmation !== "UNCONFIRMED"
      ) {
        throw new Error(
          "Só lançamentos MANUAL não confirmados podem ser promovidos",
        );
      }

      const real = await ledger.findByEndToEndId(input.realEndToEndId);
      const teamIds = new Set(
        [manual.teamId, real?.teamId].filter((t): t is string => Boolean(t)),
      );
      if (manual.teamId && real?.teamId && manual.teamId !== real.teamId) {
        throw new Error("Pix real já atribuído a outra equipe");
      }
      for (const teamId of Array.from(teamIds).sort())
        await ledger.lockTeam(teamId);

      if (!real) {
        await ledger.updatePayment(manual.id, {
          endToEndId: input.realEndToEndId,
          txid: manual.txid ?? input.txid ?? null,
          confirmation: "CONFIRMED",
        });
      } else {
        await ledger.deletePayment(manual.id);
        await ledger.updatePayment(real.id, {
          teamId: real.teamId ?? manual.teamId,
          attributionReason: real.teamId
            ? real.attributionReason
            : manual.attributionReason,
          payerName: real.payerName ?? manual.payerName,
          note: real.note ?? manual.note,
          confirmation: "CONFIRMED",
        });
      }

      for (const teamId of Array.from(teamIds)) {
        await reallocateTeam(ledger, teamId, deps.installmentAmountCents);
      }

      await ledger.appendAudit({
        paymentId: real?.id ?? manual.id,
        teamId: manual.teamId,
        action: "PAYMENT_PROMOTED_TO_CONFIRMED",
        before: { endToEndId: manual.endToEndId, confirmation: "UNCONFIRMED" },
        after: { endToEndId: input.realEndToEndId, merged: Boolean(real) },
        userEmail: input.userEmail ?? null,
      });

      return { paymentId: real?.id ?? manual.id };
    });
  };
}
