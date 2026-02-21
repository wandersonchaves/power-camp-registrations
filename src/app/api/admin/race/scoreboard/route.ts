import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = schema.parse(Object.fromEntries(url.searchParams));

    const teams = await prisma.team.findMany({ orderBy: { code: "asc" } });

    const counts = await Promise.all(
      teams.map(async (t) => {
        const [confirmed, pending] = await Promise.all([
          prisma.enrollment.count({
            where: { eventId: q.eventId, teamId: t.id, status: "CONFIRMED" },
          }),
          prisma.enrollment.count({
            where: { eventId: q.eventId, teamId: t.id, status: "PENDING" },
          }),
        ]);

        const milestone50 = await prisma.teamMilestone.findUnique({
          where: {
            eventId_teamId_milestone: {
              eventId: q.eventId,
              teamId: t.id,
              milestone: 50,
            },
          },
        });

        return {
          team: { code: t.code, name: t.name },
          confirmed,
          pending,
          milestone50,
        };
      }),
    );

    const award = await prisma.teamAward.findUnique({
      where: {
        eventId_awardKey: { eventId: q.eventId, awardKey: "FIRST_50_PAID" },
      },
      include: { winnerTeam: true },
    });

    return NextResponse.json(
      { eventId: q.eventId, counts, award },
      { status: 200 },
    );
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.statusCode },
    );
  }
}
