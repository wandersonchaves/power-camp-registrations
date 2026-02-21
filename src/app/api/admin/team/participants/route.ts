import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().min(1),
  teamCode: z.enum(["AGUIA", "LEAO"]),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = schema.parse(Object.fromEntries(url.searchParams));

    const team = await prisma.team.findUnique({ where: { code: q.teamCode } });
    if (!team)
      return NextResponse.json({ error: "TEAM_NOT_FOUND" }, { status: 404 });

    const where = {
      eventId: q.eventId,
      teamId: team.id,
      ...(q.status ? { status: q.status } : {}),
    } as const;

    const [items, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        include: {
          participant: true,
          initialPayment: true,
        },
        orderBy: [{ status: "asc" }, { reservedAt: "asc" }],
        skip: q.page * q.pageSize,
        take: q.pageSize,
      }),
      prisma.enrollment.count({ where }),
    ]);

    return NextResponse.json(
      { total, page: q.page, pageSize: q.pageSize, items },
      { status: 200 },
    );
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
