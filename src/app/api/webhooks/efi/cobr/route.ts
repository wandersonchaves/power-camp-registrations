import { NextResponse } from "next/server";

import { assertEfiWebhookAllowed } from "@/infra/efi/webhooks/efi-webhook.guard";
import { toAppError } from "@/lib/http-errors";
import { handleWebhookCobrUseCase } from "@/use-cases/webhooks/handle-webhook-cobr.use-case";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    try {
      assertEfiWebhookAllowed(req);
    } catch (err) {
      console.error("[EFI webhook cobr] unauthorized", {
        msg: err instanceof Error ? err.message : "guard_failed",
      });
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const payload = await req.json();
    const res = await handleWebhookCobrUseCase(payload);
    return NextResponse.json(res, { status: 200 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.statusCode },
    );
  }
}
