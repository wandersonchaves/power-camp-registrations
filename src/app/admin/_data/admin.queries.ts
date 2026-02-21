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
