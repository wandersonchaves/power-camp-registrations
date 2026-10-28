// src/domain/team-installments/allocate.ts
import { isExactMultiple } from "./money";
import type {
  InstallmentInput,
  PaymentAllocationResult,
  PaymentInput,
} from "./types";

export interface AllocateOptions {
  /** Valor unitário da parcela; só múltiplos exatos dele entram no ledger. */
  installmentAmountCents: number;
}

/**
 * Alocação FIFO determinística (função pura, sem I/O).
 *
 * - Pagamentos são processados por (paidAt, endToEndId): a ordem do array de
 *   entrada ou de chegada não altera o resultado.
 * - Cada pagamento quita as parcelas abertas mais antigas da própria equipe.
 * - Valor não múltiplo da parcela => IGNORED; sem equipe => UNATTRIBUTED.
 * - Sobra sem parcela aberta fica em `unallocatedCents` (status PARTIAL).
 */
export function allocate(
  payments: readonly PaymentInput[],
  installments: readonly InstallmentInput[],
  options: AllocateOptions,
): PaymentAllocationResult[] {
  const openByTeam = groupOpenInstallments(installments);

  return [...payments]
    .sort(
      (a, b) =>
        a.paidAt.getTime() - b.paidAt.getTime() ||
        compareStrings(a.endToEndId, b.endToEndId),
    )
    .map((payment) => allocateOne(payment, openByTeam, options));
}

function allocateOne(
  payment: PaymentInput,
  openByTeam: Map<string, InstallmentInput[]>,
  { installmentAmountCents }: AllocateOptions,
): PaymentAllocationResult {
  const base = { paymentId: payment.id, allocations: [] };

  if (!isExactMultiple(payment.amountCents, installmentAmountCents)) {
    return {
      ...base,
      status: "IGNORED",
      reason: "NOT_MULTIPLE_OF_INSTALLMENT",
      unallocatedCents: payment.amountCents,
    };
  }

  if (!payment.teamId) {
    return {
      ...base,
      status: "UNATTRIBUTED",
      reason: "NO_TEAM",
      unallocatedCents: payment.amountCents,
    };
  }

  const open = openByTeam.get(payment.teamId) ?? [];
  const allocations: PaymentAllocationResult["allocations"] = [];
  let remaining = payment.amountCents;

  while (open.length > 0 && remaining >= open[0].amountCents) {
    const installment = open.shift() as InstallmentInput;
    allocations.push({
      installmentId: installment.id,
      amountCents: installment.amountCents,
    });
    remaining -= installment.amountCents;
  }

  return {
    paymentId: payment.id,
    status: remaining === 0 ? "ALLOCATED" : "PARTIAL",
    allocations,
    unallocatedCents: remaining,
  };
}

function groupOpenInstallments(installments: readonly InstallmentInput[]) {
  const byTeam = new Map<string, InstallmentInput[]>();
  const ordered = [...installments].sort(
    (a, b) =>
      a.dueMonth.getTime() - b.dueMonth.getTime() || compareStrings(a.id, b.id),
  );
  for (const inst of ordered) {
    const list = byTeam.get(inst.teamId) ?? [];
    list.push(inst);
    byTeam.set(inst.teamId, list);
  }
  return byTeam;
}

function compareStrings(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
