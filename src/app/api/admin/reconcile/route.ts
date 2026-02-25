// src/app/api/admin/reconcile/route.ts
import { NextResponse } from "next/server";

import { reconcilePendingCobs } from "@/use-cases/reconcile/reconcile-pending-cobs.use-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await reconcilePendingCobs({ limit: 300 });
  return NextResponse.json(result);
}
