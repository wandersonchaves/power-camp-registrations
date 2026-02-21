import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Input = {
  txid: string;
  paidAt: Date;
  rawPayload?: Prisma.JsonValue;
};

const LIMIT = 50;
const AWARD_KEY = "FIRST_50_PAID";
const AWARD_POINTS = 100; // <-- ajuste aqui

export async function confirmInitialPaymentAndAwardUseCase(input: Input) {
  return prisma.$transaction(async (tx) => {
    // 1) localizar tentativa pelo txid
    const attempt = await tx.initialPaymentAttempt.findFirst({
      where: { txid: input.txid },
      include: { enrollment: { include: { team: true, event: true } } },
    });

    if (!attempt)
      throw new AppError(
        "Initial payment attempt not found",
        404,
        "INITIAL_PAYMENT_NOT_FOUND",
      );

    // idempotência: se já está PAID, não reprocessa
    if (attempt.status === "PAID") {
      return { ok: true, alreadyProcessed: true };
    }

    // 2) marcar attempt como PAID e guardar paidAt
    const updatedAttempt = await tx.initialPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "PAID",
        paidAt: input.paidAt,
        payload: asInputJson(input.rawPayload),
      },
    });

    // 3) confirmar enrollment
    const updatedEnrollment = await tx.enrollment.update({
      where: { id: attempt.enrollmentId },
      data: { status: "CONFIRMED", confirmedAt: input.paidAt },
      include: { team: true, event: true },
    });

    const eventId = updatedEnrollment.eventId;
    const teamId = updatedEnrollment.teamId;

    // 4) contar CONFIRMED por equipe
    const confirmedCount = await tx.enrollment.count({
      where: { eventId, teamId, status: "CONFIRMED" },
    });

    // 5) Se alcançou 50 agora, registrar milestone (unique garante “uma vez”)
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

    // 6) Decidir premiação se ainda não existe
    const existingAward = await tx.teamAward.findUnique({
      where: { eventId_awardKey: { eventId, awardKey: AWARD_KEY } },
    });

    if (!existingAward) {
      // buscar milestones dos dois times (se existirem)
      const milestones = await tx.teamMilestone.findMany({
        where: { eventId, milestone: LIMIT },
        orderBy: { achievedAt: "asc" },
        take: 2,
      });

      if (milestones.length === 2) {
        const winner = milestones[0]; // menor achievedAt vence

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
      team: updatedEnrollment.team.code,
      confirmedCount,
      paidAt: updatedAttempt.paidAt?.toISOString(),
    };
  });
}
