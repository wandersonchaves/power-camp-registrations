// src/use-cases/team-installments/ports.ts
// Portas (Dependency Inversion): os use-cases dependem destas interfaces,
// nunca de Prisma/Efí. Os adaptadores vivem em src/infra/team-installments.
import type { MatrixInstallmentInput } from "@/domain/team-installments/installment-matrix";
import type {
  AllocationPaymentStatus,
  InstallmentInput,
  PaymentAllocationResult,
} from "@/domain/team-installments/types";

export type TeamPaymentSource =
  | "WEBHOOK"
  | "RECONCILIATION"
  | "IMPORT"
  | "MANUAL";
export type TeamPaymentConfirmation = "CONFIRMED" | "UNCONFIRMED";

export interface PaymentRecord {
  id: string;
  endToEndId: string;
  txid: string | null;
  amountCents: number;
  paidAt: Date;
  payerName: string | null;
  payerDocument: string | null;
  teamId: string | null;
  source: TeamPaymentSource;
  confirmation: TeamPaymentConfirmation;
  status: AllocationPaymentStatus;
  attributionReason: string | null;
  createdByUserId: string | null;
  note: string | null;
}

export type NewPayment = Omit<PaymentRecord, "id">;
export type PaymentPatch = Partial<
  Pick<
    PaymentRecord,
    | "endToEndId"
    | "txid"
    | "payerName"
    | "payerDocument"
    | "teamId"
    | "confirmation"
    | "attributionReason"
    | "note"
  >
>;

export interface AuditEntry {
  paymentId?: string | null;
  teamId?: string | null;
  action: string;
  before?: unknown;
  after?: unknown;
  userEmail?: string | null;
}

/** Operações do ledger — sempre executadas dentro de uma unidade de trabalho. */
export interface TeamLedger {
  /** Serializa alocações concorrentes da mesma equipe (advisory lock por transação). */
  lockTeam(teamId: string): Promise<void>;
  /** INSERT ... ON CONFLICT DO NOTHING. Retorna true se criou. */
  insertIfAbsent(payment: NewPayment): Promise<boolean>;
  findByEndToEndId(endToEndId: string): Promise<PaymentRecord | null>;
  findById(id: string): Promise<PaymentRecord | null>;
  updatePayment(id: string, patch: PaymentPatch): Promise<void>;
  deletePayment(id: string): Promise<void>;
  listPaymentsByTeam(teamId: string): Promise<PaymentRecord[]>;
  listInstallmentsByTeam(teamId: string): Promise<InstallmentInput[]>;
  /** Substitui as alocações da equipe pelo resultado de `allocate` e sincroniza status. */
  replaceAllocations(
    teamId: string,
    results: PaymentAllocationResult[],
  ): Promise<void>;
  /** Cria o alias se ainda não existir. Retorna true se criou. */
  createAliasIfAbsent(
    normalizedName: string,
    teamId: string,
    createdBy: string | null,
  ): Promise<boolean>;
  appendAudit(entry: AuditEntry): Promise<void>;
}

export interface TeamLedgerUnitOfWork {
  run<T>(work: (ledger: TeamLedger) => Promise<T>): Promise<T>;
}

/** Equipe de uma cobrança emitida pelo sistema, a partir do txid. */
export interface TxidTeamResolver {
  findTeamId(txid: string): Promise<string | null>;
}

/** Alias de pagador (nome normalizado) configurado por admin. */
export interface PayerAliasLookup {
  findTeamId(normalizedName: string): Promise<string | null>;
}

export interface ReceivedPixItem {
  endToEndId: string;
  txid: string | null;
  amountCents: number;
  paidAt: Date;
  payerName: string | null;
  payerDocument: string | null;
}

export interface ReceivedPixPage {
  items: ReceivedPixItem[];
  totalPages: number;
}

/** Fonte de Pix recebidos (Efí GET /v2/pix) — somente leitura. */
export interface ReceivedPixSource {
  fetchPage(range: {
    from: Date;
    to: Date;
    page: number;
  }): Promise<ReceivedPixPage>;
}

export interface PaymentListRow {
  id: string;
  endToEndId: string;
  txid: string | null;
  amountCents: number;
  paidAt: Date;
  payerName: string | null;
  payerDocument: string | null;
  teamCode: string | null;
  source: TeamPaymentSource;
  confirmation: TeamPaymentConfirmation;
  status: AllocationPaymentStatus;
  attributionReason: string | null;
  note: string | null;
}

/** Modelo de leitura da tela admin (consultas, sem regras de negócio). */
export interface TeamInstallmentReadModel {
  listInstallmentsWithPayment(): Promise<MatrixInstallmentInput[]>;
  listPayments(filter: {
    statuses?: AllocationPaymentStatus[];
    confirmation?: TeamPaymentConfirmation;
  }): Promise<PaymentListRow[]>;
  findTeamIdByCode(code: string): Promise<string | null>;
}
