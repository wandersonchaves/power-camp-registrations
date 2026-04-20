import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { toAppError } from "@/lib/http-errors";
import { runTeamRecurrenceBatchUseCase } from "@/use-cases/pix-auto/run-team-recurrence-batch.use-case";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().optional(),
  teamCode: z.enum(["AGUIA", "LEAO"]).optional(),
  targetCompetencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  dueDateDay: z.number().int().min(1).max(28).optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = schema.parse(await req.json());

    // Default eventId from env if not provided
    const eventId = body.eventId || process.env.POWERCAMP_EVENT_ID;
    if (!eventId) {
      return NextResponse.json(
        {
          error: "EVENT_ID_REQUIRED",
          message: "Falta definir POWERCAMP_EVENT_ID",
        },
        { status: 400 },
      );
    }

    const result = await runTeamRecurrenceBatchUseCase({
      eventId,
      teamCode: body.teamCode,
      targetCompetencia: body.targetCompetencia,
      dueDateDay: body.dueDateDay,
    });

    return NextResponse.json(result);
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
