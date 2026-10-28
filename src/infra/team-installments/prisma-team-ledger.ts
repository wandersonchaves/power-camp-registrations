// src/infra/team-installments/prisma-team-ledger.ts
import type { Prisma, PrismaClient, TeamPayment } from "@prisma/client";

import type { PaymentAllocationResult } from "@/domain/team-installments/types";
import type {
  AuditEntry,
  NewPayment,
  PaymentPatch,
  PaymentRecord,
  TeamLedger,
  TeamLedgerUnitOfWork,
} from "@/use-cases/team-installments/ports";

function toRecord(row: TeamPayment): PaymentRecord {
  return {
    id: row.id,
    endToEndId: row.endToEndId,
    txid: row.txid,
    amountCents: row.amountCents,
    paidAt: row.paidAt,
    payerName: row.payerName,
    payerDocument: row.payerDocument,
    teamId: row.teamId,
    source: row.source,
    confirmation: row.confirmation,
    status: row.status,
    attributionReason: row.attributionReason,
    createdByUserId: row.createdByUserId,
    note: row.note,
  };
}

const asJson = (v: unknown) =>
  (v === undefined || v === null ? undefined : v) as
    | Prisma.InputJsonValue
    | undefined;

export class PrismaTeamLedger implements TeamLedger {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async lockTeam(teamId: string) {
    // Reentrante dentro da mesma transação; liberado no commit/rollback.
    await this.tx
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team-installments:${teamId}`}))`;
  }

  async insertIfAbsent(payment: NewPayment) {
    const { count } = await this.tx.teamPayment.createMany({
      data: payment,
      skipDuplicates: true, // INSERT ... ON CONFLICT DO NOTHING
    });
    return count === 1;
  }

  async findByEndToEndId(endToEndId: string) {
    const row = await this.tx.teamPayment.findUnique({ where: { endToEndId } });
    return row ? toRecord(row) : null;
  }

  async findById(id: string) {
    const row = await this.tx.teamPayment.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async updatePayment(id: string, patch: PaymentPatch) {
    await this.tx.teamPayment.update({ where: { id }, data: patch });
  }

  async deletePayment(id: string) {
    await this.tx.teamPayment.delete({ where: { id } });
  }

  async listPaymentsByTeam(teamId: string) {
    const rows = await this.tx.teamPayment.findMany({
      where: { teamId },
      orderBy: [{ paidAt: "asc" }, { endToEndId: "asc" }],
    });
    return rows.map(toRecord);
  }

  async listInstallmentsByTeam(teamId: string) {
    return this.tx.teamInstallment.findMany({
      where: { teamId },
      orderBy: { dueMonth: "asc" },
      select: { id: true, teamId: true, dueMonth: true, amountCents: true },
    });
  }

  async replaceAllocations(teamId: string, results: PaymentAllocationResult[]) {
    const paymentIds = results.map((r) => r.paymentId);

    // Inclui alocações órfãs de pagamentos que mudaram de equipe.
    await this.tx.teamPaymentAllocation.deleteMany({
      where: {
        OR: [{ installment: { teamId } }, { paymentId: { in: paymentIds } }],
      },
    });

    const data = results.flatMap((r) =>
      r.allocations.map((a) => ({
        paymentId: r.paymentId,
        installmentId: a.installmentId,
        amountCents: a.amountCents,
      })),
    );
    if (data.length > 0) {
      await this.tx.teamPaymentAllocation.createMany({ data });
    }

    for (const r of results) {
      await this.tx.teamPayment.updateMany({
        where: { id: r.paymentId, NOT: { status: r.status } },
        data: { status: r.status },
      });
    }
  }

  async appendAudit(entry: AuditEntry) {
    await this.tx.teamPaymentAuditLog.create({
      data: {
        paymentId: entry.paymentId ?? null,
        teamId: entry.teamId ?? null,
        action: entry.action,
        before: asJson(entry.before),
        after: asJson(entry.after),
        userEmail: entry.userEmail ?? null,
      },
    });
  }
}

export class PrismaTeamLedgerUnitOfWork implements TeamLedgerUnitOfWork {
  constructor(private readonly client: PrismaClient) {}

  run<T>(work: (ledger: TeamLedger) => Promise<T>) {
    return this.client.$transaction((tx) => work(new PrismaTeamLedger(tx)), {
      timeout: 15_000,
      maxWait: 10_000,
    });
  }
}
