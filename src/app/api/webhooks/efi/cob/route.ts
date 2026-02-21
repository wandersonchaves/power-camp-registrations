import { NextResponse } from "next/server";

import { toAppError } from "@/lib/http-errors";
import { confirmInitialPaymentAndAwardUseCase } from "@/use-cases/race/confirm-initial-payment-and-award.use-case";
import { mapEfiWebhookToPaymentEvent } from "@/use-cases/webhooks/map-efi-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (
      process.env.WEBHOOK_SHARED_SECRET &&
      secret !== process.env.WEBHOOK_SHARED_SECRET
    ) {
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
