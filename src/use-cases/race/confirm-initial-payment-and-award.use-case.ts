import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";

type Input = {
  txid: string;
  paidAt: Date;
  rawPayload?: Prisma.JsonValue;
};

const LIMIT = 50;
const AWARD_KEY = "FIRST_50_PAID";
const AWARD_POINTS = 100;

export async function confirmInitialPaymentAndAwardUseCase(input: Input) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.initialPaymentAttempt.findFirst({
      where: { txid: input.txid },
      select: {
        id: true,
        status: true,
        enrollmentId: true,
        enrollment: {
          select: {
            id: true,
            eventId: true,
            teamId: true,
            status: true,
            team: { select: { id: true, code: true } },
          },
        },
      },
    });

    if (!attempt) {
      throw new AppError(
        "Initial payment attempt not found",
        404,
        "INITIAL_PAYMENT_NOT_FOUND",
      );
    }

    // idempotência: já processado
    if (attempt.status === "PAID") {
      return { ok: true, alreadyProcessed: true };
    }

    // marca attempt como pago
    await tx.initialPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "PAID",
        paidAt: input.paidAt,
        ...(input.rawPayload ? { payload: input.rawPayload } : {}),
      },
    });

    // confirma enrollment (se já confirmado, não altera)
    const updatedEnrollment = await tx.enrollment.update({
      where: { id: attempt.enrollmentId },
      data: {
        status: "CONFIRMED",
        confirmedAt: input.paidAt,
      },
      select: {
        id: true,
        eventId: true,
        teamId: true,
        team: { select: { id: true, code: true } },
      },
    });

    // se LOTE_ZERO (sem time), não premia corrida por equipe
    if (!updatedEnrollment.teamId) {
      return {
        ok: true,
        enrollmentId: updatedEnrollment.id,
        team: null,
        confirmedCount: null,
        paidAt: input.paidAt.toISOString(),
        note: "Enrollment has no teamId (LOTE_ZERO). Award flow skipped.",
      };
    }

    const eventId = updatedEnrollment.eventId;
    const teamId = updatedEnrollment.teamId;

    // conta confirmados por equipe
    const confirmedCount = await tx.enrollment.count({
      where: { eventId, teamId, status: "CONFIRMED" },
    });

    // milestone dos 50 (unique no schema para garantir 1x)
    if (confirmedCount === LIMIT) {
      await tx.teamMilestone.create({
        data: {
          eventId,
          teamId,
          milestone: LIMIT,
          achievedAt: input.paidAt,
          enrollmentId: updatedEnrollment.id,
          txid: input.txid,
        },
      });
    }

    // decide premiação se ainda não existe
    const existingAward = await tx.teamAward.findUnique({
      where: { eventId_awardKey: { eventId, awardKey: AWARD_KEY } },
      select: { id: true },
    });

    if (!existingAward) {
      const milestones = await tx.teamMilestone.findMany({
        where: { eventId, milestone: LIMIT },
        orderBy: { achievedAt: "asc" },
        take: 2,
        select: { teamId: true, achievedAt: true },
      });

      if (milestones.length === 2) {
        const winner = milestones[0];

        await tx.teamAward.create({
          data: {
            eventId,
            awardKey: AWARD_KEY,
            winnerTeamId: winner.teamId,
            pointsGranted: AWARD_POINTS,
            decidedAt: new Date(),
            decidedByRule:
              "FIRST_TEAM_TO_50_CONFIRMED_PAYMENTS (achievedAt earliest)",
            tieBreakNote: `winner achievedAt=${winner.achievedAt.toISOString()}`,
          },
        });
      }
    }

    return {
      ok: true,
      enrollmentId: updatedEnrollment.id,
      team: updatedEnrollment.team?.code,
      confirmedCount,
      paidAt: input.paidAt.toISOString(),
    };
  });
}
