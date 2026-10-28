// src/infra/team-installments/prisma-read-model.ts
import type { PrismaClient, TeamPayment } from "@prisma/client";

import type {
  PaymentListRow,
  TeamInstallmentReadModel,
} from "@/use-cases/team-installments/ports";

type PaymentWithTeam = TeamPayment & { team: { code: string } | null };

function toListRow(r: PaymentWithTeam): PaymentListRow {
  return {
    id: r.id,
    endToEndId: r.endToEndId,
    txid: r.txid,
    amountCents: r.amountCents,
    paidAt: r.paidAt,
    payerName: r.payerName,
    payerDocument: r.payerDocument,
    teamCode: r.team?.code ?? null,
    source: r.source,
    confirmation: r.confirmation,
    status: r.status,
    attributionReason: r.attributionReason,
    note: r.note,
  };
}

export class PrismaTeamInstallmentReadModel
  implements TeamInstallmentReadModel
{
  constructor(private readonly client: PrismaClient) {}

  async listInstallmentsWithPayment() {
    const rows = await this.client.teamInstallment.findMany({
      orderBy: { dueMonth: "asc" },
      select: {
        id: true,
        teamId: true,
        dueMonth: true,
        amountCents: true,
        team: { select: { code: true } },
        allocations: {
          select: { payment: { select: { id: true, confirmation: true } } },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      teamCode: r.team.code,
      dueMonth: r.dueMonth,
      amountCents: r.amountCents,
      payment: r.allocations[0]?.payment ?? null,
    }));
  }

  async listPayments(
    filter: Parameters<TeamInstallmentReadModel["listPayments"]>[0],
  ) {
    const rows = await this.client.teamPayment.findMany({
      where: {
        ...(filter.statuses && { status: { in: filter.statuses } }),
        ...(filter.confirmation && { confirmation: filter.confirmation }),
      },
      orderBy: [{ paidAt: "asc" }, { endToEndId: "asc" }],
      take: 500,
      include: { team: { select: { code: true } } },
    });

    return rows.map(toListRow);
  }

  async getPayment(id: string) {
    const row = await this.client.teamPayment.findUnique({
      where: { id },
      include: { team: { select: { code: true } } },
    });
    return row ? toListRow(row) : null;
  }

  async findPaymentsByEndToEndIds(endToEndIds: string[]) {
    const rows = await this.client.teamPayment.findMany({
      where: { endToEndId: { in: endToEndIds } },
      include: { team: { select: { code: true } } },
    });
    return new Map(rows.map((r) => [r.endToEndId, toListRow(r)]));
  }

  listTeams() {
    return this.client.team.findMany({ select: { id: true, code: true } });
  }

  async findTeamIdByCode(code: string) {
    const team = await this.client.team.findFirst({
      where: { code: code as "AGUIA" | "LEAO" },
      select: { id: true },
    });
    return team?.id ?? null;
  }
}
