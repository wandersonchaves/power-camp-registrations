// src/use-cases/team-installments/reallocate-team.ts
import type { TeamLedger } from "./ports";

import { allocate } from "@/domain/team-installments/allocate";

/**
 * Recalcula do zero a alocação FIFO da equipe a partir do ledger.
 * Deve ser chamada dentro de uma unidade de trabalho.
 */
export async function reallocateTeam(
  ledger: TeamLedger,
  teamId: string,
  installmentAmountCents: number,
) {
  await ledger.lockTeam(teamId);

  const [payments, installments] = await Promise.all([
    ledger.listPaymentsByTeam(teamId),
    ledger.listInstallmentsByTeam(teamId),
  ]);

  const results = allocate(payments, installments, { installmentAmountCents });
  await ledger.replaceAllocations(teamId, results);
}
