import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { toAppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().optional(),
  teamCode: z.enum(["AGUIA", "LEAO"]).optional(),
  targetCompetencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await req.json());

    const eventId = body.eventId || process.env.POWERCAMP_EVENT_ID;
    if (!eventId) throw new Error("EVENT_ID_REQUIRED");

    const now = new Date();
    const competencia =
      body.targetCompetencia ||
      `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

    console.log(
      `[PREVIEW] Checking competencia ${competencia} for team ${body.teamCode} and event ${eventId}`,
    );

    const recurrences = await prisma.pixAutoRecurrence.findMany({
      where: {
        eventId,
        status: { in: ["APROVADA", "CRIADA", "ATIVA"] },
        participant: {
          enrollments: {
            some: {
              eventId,
              ...(body.teamCode ? { team: { code: body.teamCode } } : {}),
              status: { in: ["PENDING", "CONFIRMED"] },
            },
          },
        },
        // Mudança: permitir se não houver cobrança ativa/concluída
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
        participant: {
          select: { fullName: true, cpf: true },
        },
      },
    });

    return NextResponse.json({
      competencia,
      count: recurrences.length,
      items: recurrences.map((r) => ({
        id: r.id,
        name: r.participant.fullName,
        cpf: r.participant.cpf,
        value: r.valorRec,
      })),
    });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.statusCode },
    );
  }
}
