import { Prisma, TeamCode } from "@prisma/client";

import type { EnrollmentRow, RaceScoreboard } from "./admin.types";

import { prisma } from "@/lib/prisma";

const LIMIT = 50;

export async function getRaceScoreboard(params: {
  eventId: string;
}): Promise<RaceScoreboard> {
  const teams = await prisma.team.findMany({ orderBy: { code: "asc" } });

  const teamsScores = await Promise.all(
    teams.map(async (t) => {
      const [confirmed, pending, milestone] = await Promise.all([
        prisma.enrollment.count({
          where: { eventId: params.eventId, teamId: t.id, status: "CONFIRMED" },
        }),
        prisma.enrollment.count({
          where: { eventId: params.eventId, teamId: t.id, status: "PENDING" },
        }),
        prisma.teamMilestone.findUnique({
          where: {
            eventId_teamId_milestone: {
              eventId: params.eventId,
              teamId: t.id,
              milestone: LIMIT,
            },
          },
          select: { achievedAt: true, txid: true, enrollmentId: true },
        }),
      ]);

      return {
        teamCode: t.code,
        teamName: t.name,
        confirmed,
        pending,
        milestone50: milestone ?? null,
      };
    }),
  );

  const award = await prisma.teamAward.findUnique({
    where: {
      eventId_awardKey: { eventId: params.eventId, awardKey: "FIRST_50_PAID" },
    },
    include: { winnerTeam: true },
  });

  return {
    eventId: params.eventId,
    teams: teamsScores,
    award: award
      ? {
          winnerTeamCode: award.winnerTeam.code,
          winnerTeamName: award.winnerTeam.name,
          pointsGranted: award.pointsGranted,
          decidedAt: award.decidedAt,
          decidedByRule: award.decidedByRule,
          tieBreakNote: award.tieBreakNote,
        }
      : null,
  };
}

export async function listEnrollments(params: {
  eventId: string;
  teamCode?: TeamCode;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  total: number;
  items: EnrollmentRow[];
  page: number;
  pageSize: number;
}> {
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? 50;

  const team = params.teamCode
    ? await prisma.team.findUnique({
        where: { code: params.teamCode },
        select: { id: true },
      })
    : null;

  const q = params.q?.trim();
  const hasQ = Boolean(q && q.length >= 2);

  const or: Prisma.EnrollmentWhereInput[] = hasQ
    ? [
        {
          participant: {
            is: {
              fullName: { contains: q!, mode: Prisma.QueryMode.insensitive },
            },
          },
        },
        {
          participant: {
            is: {
              cpf: { contains: q! },
            },
          },
        },
        {
          initialPayment: {
            is: {
              txid: { contains: q! },
            },
          },
        },
      ]
    : [];

  const where: Prisma.EnrollmentWhereInput = {
    eventId: params.eventId,
    ...(team ? { teamId: team.id } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(hasQ ? { OR: or } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({
      where,
      // ✅ select (melhor performance + tipagem perfeita)
      select: {
        id: true,
        status: true,
        reservedAt: true,
        confirmedAt: true,
        team: { select: { code: true, name: true } },
        participant: { select: { id: true, fullName: true, cpf: true } },
        initialPayment: {
          select: { txid: true, status: true, amount: true, paidAt: true },
        },
      },
      orderBy: [{ status: "asc" }, { reservedAt: "asc" }],
      skip: page * pageSize,
      take: pageSize,
    }),
  ]);

  const items: EnrollmentRow[] = rows.map((r) => ({
    enrollmentId: r.id,
    status: r.status,
    reservedAt: r.reservedAt,
    confirmedAt: r.confirmedAt,

    teamCode: r.team?.code ?? null,
    teamName: r.team?.name ?? "Lote Zero",

    participantId: r.participant.id,
    participantName: r.participant.fullName,
    participantCpf: r.participant.cpf,

    initialPayment: r.initialPayment
      ? {
          txid: r.initialPayment.txid,
          status: r.initialPayment.status,
          amount: r.initialPayment.amount,
          paidAt: r.initialPayment.paidAt,
        }
      : null,
  }));

  return { total, items, page, pageSize };
}

export async function getRecurringSummary(params: { eventId: string }) {
  const teams = await prisma.team.findMany({ orderBy: { code: "asc" } });

  const now = new Date();
  const competencia = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const summary = await Promise.all(
    teams.map(async (t) => {
      const recurrences = await prisma.pixAutoRecurrence.findMany({
        where: {
          eventId: params.eventId,
          status: { in: ["APROVADA", "CRIADA", "ATIVA"] },
          participant: {
            enrollments: {
              some: {
                eventId: params.eventId,
                teamId: t.id,
                status: { in: ["PENDING", "CONFIRMED"] },
              },
            },
          },
          // Permitir se não houver cobrança ativa ou paga no mês
          charges: {
            none: {
              competencia,
              status: { in: ["ATIVA", "CONCLUIDA", "PAGO"] },
            },
          },
        },
        select: {
          id: true,
          valorRec: true,
        },
      });

      const totalValue = recurrences.reduce(
        (acc, r) => acc + Number(r.valorRec),
        0,
      );

      return {
        teamCode: t.code,
        teamName: t.name,
        activeCount: recurrences.length,
        totalMonthlyValue: totalValue.toFixed(2),
      };
    }),
  );

  return summary;
}

export async function getInstallmentTracking(params: { eventId: string }) {
  const recurrences = await prisma.pixAutoRecurrence.findMany({
    where: {
      eventId: params.eventId,
      objeto: { contains: "Equipe" },
    },
    select: {
      id: true,
      valorRec: true,
      participant: {
        select: { fullName: true },
      },
      event: {
        select: { name: true },
      },
      participantId: true,
      charges: {
        orderBy: { competencia: "asc" },
        select: {
          competencia: true,
          status: true,
          paidAt: true,
          valorOriginal: true,
        },
      },
    },
    orderBy: { participant: { fullName: "asc" } },
  });

  // Busca pagamentos iniciais dos mesmos participantes (Mês 1)
  const participantIds = recurrences.map((r) => r.participantId);
  const initialPayments = await prisma.enrollment.findMany({
    where: {
      eventId: params.eventId,
      participantId: { in: participantIds },
    },
    select: {
      participantId: true,
      status: true,
      confirmedAt: true,
      initialPayment: {
        select: {
          amount: true,
          status: true,
          paidAt: true,
        },
      },
    },
  });

  const initialByParticipant = new Map(
    initialPayments.map((p) => [p.participantId, p]),
  );

  return recurrences.map((r) => {
    const initial = initialByParticipant.get(r.participantId);
    return {
      id: r.id,
      participantName: r.participant.fullName,
      valorEquipe: r.valorRec,
      initial: {
        status: initial?.status || "PENDING",
        paidAt: initial?.confirmedAt || initial?.initialPayment?.paidAt || null,
        amount: initial?.initialPayment?.amount || "0.00",
      },
      monthlyCharges: r.charges,
    };
  });
}
