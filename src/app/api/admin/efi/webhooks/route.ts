import { NextResponse } from "next/server";
import { z } from "zod";

import { efiWebhookClient } from "@/infra/efi/webhooks/efi-webhook.client";
import { toAppError } from "@/lib/http-errors";

export const runtime = "nodejs";

const postSchema = z.object({
  webhookrecUrl: z.string().url().optional(),
  webhookcobrUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  try {
    const body = postSchema.parse(await req.json());

    if (body.webhookrecUrl)
      await efiWebhookClient.webhookrec.set({ webhookUrl: body.webhookrecUrl });
    if (body.webhookcobrUrl)
      await efiWebhookClient.webhookcobr.set({
        webhookUrl: body.webhookcobrUrl,
      });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}

export async function GET() {
  try {
    const [rec, cobr] = await Promise.all([
      efiWebhookClient.webhookrec.get().catch(() => null),
      efiWebhookClient.webhookcobr.get().catch(() => null),
    ]);

    return NextResponse.json(
      { ok: true, webhookrec: rec, webhookcobr: cobr },
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

export async function DELETE() {
  try {
    await Promise.all([
      efiWebhookClient.webhookrec.delete().catch(() => undefined),
      efiWebhookClient.webhookcobr.delete().catch(() => undefined),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.statusCode },
    );
  }
}
