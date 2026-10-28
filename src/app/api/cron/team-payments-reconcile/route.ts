// src/app/api/cron/team-payments-reconcile/route.ts
import { type NextRequest, NextResponse } from "next/server";

import { getTeamInstallmentConfig } from "@/infra/team-installments/config";
import { getTeamInstallments } from "@/infra/team-installments/container";
import { isValidCronAuthorization } from "@/lib/auth/cron-secret";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_DAYS = 7;
const MAX_DAYS = 31;

/**
 * Job diário (Railway cron): reconcilia os Pix dos últimos N dias (padrão 7)
 * contra a Efí. Protegido por `Authorization: Bearer $CRON_SECRET`.
 * `?days=` permite backfill (máx. 31).
 */
async function handle(req: NextRequest) {
  if (!isValidCronAuthorization(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    if (!getTeamInstallmentConfig().enabled) {
      return NextResponse.json({ enabled: false });
    }

    const requested = Number(req.nextUrl.searchParams.get("days"));
    const days =
      Number.isInteger(requested) && requested > 0
        ? Math.min(requested, MAX_DAYS)
        : DEFAULT_DAYS;

    const report = await getTeamInstallments().reconcileTeamPayments({ days });
    log("info", "[team-payments-reconcile] done", { days, ...report });
    return NextResponse.json({ ok: true, days, ...report });
  } catch (err) {
    log("error", "[team-payments-reconcile] failed", {
      msg: err instanceof Error ? err.message : "unknown_error",
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
