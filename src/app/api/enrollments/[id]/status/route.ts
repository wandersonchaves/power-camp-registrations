// src/app/api/enrollments/[id]/status/route.ts
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const e = await prisma.enrollment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      confirmedAt: true,
      initialPayment: { select: { status: true, paidAt: true } },
    },
  });

  if (!e) return NextResponse.json({ ok: false }, { status: 404 });

  return NextResponse.json({
    ok: true,
    enrollment: {
      id: e.id,
      status: e.status,
      confirmedAt: e.confirmedAt,
    },
    initialPayment: e.initialPayment
      ? { status: e.initialPayment.status, paidAt: e.initialPayment.paidAt }
      : null,
  });
}
