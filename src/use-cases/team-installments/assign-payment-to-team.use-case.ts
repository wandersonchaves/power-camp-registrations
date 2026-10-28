// src/use-cases/team-installments/assign-payment-to-team.use-case.ts
import type { TeamLedgerUnitOfWork } from "./ports";
import { reallocateTeam } from "./reallocate-team";

import { normalizePayerName } from "@/domain/team-installments/normalize-name";

/** Resolve um Pix UNATTRIBUTED atribuindo-o a uma equipe (e, opcionalmente, salvando o alias). */
export function makeAssignPaymentToTeam(deps: {
  uow: TeamLedgerUnitOfWork;
  installmentAmountCents: number;
}) {
  return async function assignPaymentToTeam(input: {
    paymentId: string;
    teamId: string;
    saveAlias: boolean;
    userEmail: string | null;
  }): Promise<{ aliasSaved: boolean }> {
    return deps.uow.run(async (ledger) => {
      await ledger.lockTeam(input.teamId);

      const payment = await ledger.findById(input.paymentId);
      if (!payment || payment.teamId || payment.status !== "UNATTRIBUTED") {
        throw new Error("Pagamento não está na fila de não atribuídos");
      }

      const reason = "atribuição manual por admin";
      await ledger.updatePayment(payment.id, {
        teamId: input.teamId,
        attributionReason: reason,
      });
      await reallocateTeam(ledger, input.teamId, deps.installmentAmountCents);

      let aliasSaved = false;
      const normalized = payment.payerName
        ? normalizePayerName(payment.payerName)
        : "";
      if (input.saveAlias && normalized) {
        aliasSaved = await ledger.createAliasIfAbsent(
          normalized,
          input.teamId,
          input.userEmail,
        );
      }

      await ledger.appendAudit({
        paymentId: payment.id,
        teamId: input.teamId,
        action: "PAYMENT_ASSIGNED_TO_TEAM",
        before: { teamId: null, status: payment.status },
        after: { teamId: input.teamId, reason, aliasSaved },
        userEmail: input.userEmail,
      });

      return { aliasSaved };
    });
  };
}
