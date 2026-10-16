import { NextResponse } from "next/server";

import { assertEfiWebhookAllowed } from "@/infra/efi/webhooks/efi-webhook.guard";
import { toAppError } from "@/lib/http-errors";
import { confirmInitialPaymentAndAwardUseCase } from "@/use-cases/race/confirm-initial-payment-and-award.use-case";
import { mapEfiWebhookToPaymentEvent } from "@/use-cases/webhooks/map-efi-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    try {
      assertEfiWebhookAllowed(req);
    } catch (err) {
      console.error("[EFI webhook cob] unauthorized", {
        msg: err instanceof Error ? err.message : "guard_failed",
      });
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const payload = await req.json();
    const evt = mapEfiWebhookToPaymentEvent(payload);

    if (!evt)
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });

    if (evt.isPaid) {
      const res = await confirmInitialPaymentAndAwardUseCase({
        txid: evt.txid,
        paidAt: evt.paidAt,
        rawPayload: payload,
      });
      return NextResponse.json(res, { status: 200 });
    }

    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
