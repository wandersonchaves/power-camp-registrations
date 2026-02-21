import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { toAppError } from "@/lib/http-errors";
import { persistWebhookEvent } from "@/use-cases/webhooks/persist-webhook-event.use-case";

export const runtime = "nodejs";

function isJsonValue(value: unknown): value is Prisma.JsonValue {
  return value !== undefined;
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (
      process.env.WEBHOOK_SHARED_SECRET &&
      secret !== process.env.WEBHOOK_SHARED_SECRET
    ) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const raw: unknown = await req.json();
    if (!isJsonValue(raw)) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    await persistWebhookEvent({ kind: "webhookrec", payload: raw });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.statusCode },
    );
  }
}
