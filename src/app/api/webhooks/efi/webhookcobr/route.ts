import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  EfiWebhookBaseSchema,
  EfiWebhookTestSchema,
  normalizePaymentEvent,
} from "@/infra/efi/webhooks/efi-webhook.schemas";
import { toAppError } from "@/lib/http-errors";
import { confirmInitialPaymentAndAwardUseCase } from "@/use-cases/race/confirm-initial-payment-and-award.use-case";
import { persistWebhookEvent } from "@/use-cases/webhooks/persist-webhook-event.use-case";

export const runtime = "nodejs";

function isJsonValue(value: unknown): value is Prisma.JsonValue {
  // Zod já garante JSON serializável quando vem de req.json()
  // mas mantemos check simples
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

    // Persistir sempre (auditoria)
    await persistWebhookEvent({ kind: "webhookcobr", payload: raw });

    // Primeiro tenta parse como “base”
    const parsedBase = EfiWebhookBaseSchema.safeParse(raw);
    if (parsedBase.success) {
      const evt = normalizePaymentEvent(parsedBase.data);

      if (evt.isPaid) {
        const res = await confirmInitialPaymentAndAwardUseCase({
          txid: evt.txid,
          paidAt: evt.paidAt,
          rawPayload: raw,
        });

        return NextResponse.json(
          { ok: true, processed: true, ...res },
          { status: 200 },
        );
      }

      return NextResponse.json(
        { ok: true, processed: false, status: evt.status },
        { status: 200 },
      );
    }

    // Se não for base, tenta parse como “teste”
    const parsedTest = EfiWebhookTestSchema.safeParse(raw);
    if (parsedTest.success) {
      return NextResponse.json({ ok: true, test: true }, { status: 200 });
    }

    // Se não bater em nenhum, retorna ok mas marca como desconhecido
    return NextResponse.json(
      {
        ok: true,
        unknownPayload: true,
        errors: flattenZodErrors(parsedBase.error),
      },
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

function flattenZodErrors(error: z.ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}
