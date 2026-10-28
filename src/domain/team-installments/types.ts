// src/domain/team-installments/types.ts

export type AllocationPaymentStatus =
  | "ALLOCATED"
  | "PARTIAL"
  | "UNATTRIBUTED"
  | "IGNORED";

export type AllocationReason = "NOT_MULTIPLE_OF_INSTALLMENT" | "NO_TEAM";

export interface PaymentInput {
  id: string;
  endToEndId: string;
  amountCents: number;
  paidAt: Date;
  teamId: string | null;
}

export interface InstallmentInput {
  id: string;
  teamId: string;
  dueMonth: Date;
  amountCents: number;
}

export interface PaymentAllocationResult {
  paymentId: string;
  status: AllocationPaymentStatus;
  reason?: AllocationReason;
  allocations: { installmentId: string; amountCents: number }[];
  /** Valor que não coube em nenhuma parcela aberta (nunca descartado). */
  unallocatedCents: number;
}
