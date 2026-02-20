import { NextResponse } from "next/server";

import { toAppError } from "@/lib/http-errors";
import { handleWebhookRecUseCase } from "@/use-cases/webhooks/handle-webhook-rec.use-case";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // opcional: validação simples por secret interno
    const secret = req.headers.get("x-webhook-secret");
    if (
      process.env.WEBHOOK_SHARED_SECRET &&
      secret !== process.env.WEBHOOK_SHARED_SECRET
    ) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const payload = await req.json();
    const res = await handleWebhookRecUseCase(payload);
    return NextResponse.json(res, { status: 200 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.statusCode },
    );
  }
}
