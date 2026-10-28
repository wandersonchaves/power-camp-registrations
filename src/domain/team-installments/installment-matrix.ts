// src/domain/team-installments/installment-matrix.ts

export type CellState = "PAID" | "PAID_UNCONFIRMED" | "OVERDUE" | "UPCOMING";

export interface MatrixInstallmentInput {
  id: string;
  teamId: string;
  teamCode: string;
  dueMonth: Date;
  amountCents: number;
  payment: { id: string; confirmation: "CONFIRMED" | "UNCONFIRMED" } | null;
}

export interface MatrixCell {
  installmentId: string;
  dueMonth: Date;
  amountCents: number;
  state: CellState;
  paymentId: string | null;
}

export interface TeamMatrix {
  teamId: string;
  teamCode: string;
  cells: MatrixCell[];
  totals: {
    paidCents: number;
    /** Parte de paidCents ainda sem confirmação da Efí. */
    unconfirmedCents: number;
    /** Vencido e não pago. */
    overdueCents: number;
    upcomingCents: number;
  };
  counts: {
    total: number;
    /** Parcelas quitadas (confirmadas + não confirmadas). */
    paid: number;
    /** Quitadas com Pix confirmado pela Efí. */
    confirmed: number;
    unconfirmed: number;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Uma parcela vence no fim do dia do vencimento (UTC). */
export function isOverdue(dueMonth: Date, now: Date) {
  return now.getTime() >= dueMonth.getTime() + DAY_MS;
}

/** Função pura: matriz equipe × mês e totais, a partir das parcelas alocadas. */
export function buildInstallmentMatrix(
  installments: readonly MatrixInstallmentInput[],
  now: Date,
): TeamMatrix[] {
  const byTeam = new Map<string, TeamMatrix>();
  const ordered = [...installments].sort(
    (a, b) =>
      a.teamCode.localeCompare(b.teamCode) ||
      a.dueMonth.getTime() - b.dueMonth.getTime(),
  );

  for (const inst of ordered) {
    let team = byTeam.get(inst.teamId);
    if (!team) {
      team = {
        teamId: inst.teamId,
        teamCode: inst.teamCode,
        cells: [],
        totals: {
          paidCents: 0,
          unconfirmedCents: 0,
          overdueCents: 0,
          upcomingCents: 0,
        },
        counts: { total: 0, paid: 0, confirmed: 0, unconfirmed: 0 },
      };
      byTeam.set(inst.teamId, team);
    }

    const state: CellState = inst.payment
      ? inst.payment.confirmation === "CONFIRMED"
        ? "PAID"
        : "PAID_UNCONFIRMED"
      : isOverdue(inst.dueMonth, now)
        ? "OVERDUE"
        : "UPCOMING";

    team.counts.total += 1;
    if (state === "PAID") {
      team.counts.paid += 1;
      team.counts.confirmed += 1;
    } else if (state === "PAID_UNCONFIRMED") {
      team.counts.paid += 1;
      team.counts.unconfirmed += 1;
    }

    if (state === "PAID") team.totals.paidCents += inst.amountCents;
    else if (state === "PAID_UNCONFIRMED") {
      team.totals.paidCents += inst.amountCents;
      team.totals.unconfirmedCents += inst.amountCents;
    } else if (state === "OVERDUE")
      team.totals.overdueCents += inst.amountCents;
    else team.totals.upcomingCents += inst.amountCents;

    team.cells.push({
      installmentId: inst.id,
      dueMonth: inst.dueMonth,
      amountCents: inst.amountCents,
      state,
      paymentId: inst.payment?.id ?? null,
    });
  }

  return Array.from(byTeam.values());
}
