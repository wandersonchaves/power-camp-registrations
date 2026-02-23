// src/app/api/webhooks/efi/webhookcobr/route.ts
import { type NextRequest, NextResponse } from "next/server";

import {
  assertEfiWebhookAllowed,
  readJsonBody,
  sha256Json,
} from "@/infra/efi/webhooks/efi-webhook.guard";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function processCobrWebhook(params: {
  kind: string;
  externalId: string;
  payload: unknown;
}) {
  const { kind, externalId, payload } = params;

  const created = await prisma.efiWebhookEvent.upsert({
    where: { kind_externalId: { kind, externalId } },
    update: {},
    create: { kind, externalId, payload: asInputJson(payload) },
    select: { id: true, processedAt: true },
  });

  if (created.processedAt) return;

  // Aqui você pode atualizar PixAutoCobr.status conforme payload (quando tiver o shape)
  await prisma.efiWebhookEvent.update({
    where: { id: created.id },
    data: { processedAt: new Date() },
  });
}

export async function POST(req: NextRequest) {
  try {
    assertEfiWebhookAllowed(req);
    const payload = await readJsonBody(req);

    await processCobrWebhook({
      kind: "webhookcobr",
      externalId: sha256Json(payload),
      payload,
    });

    return new NextResponse("200", { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    return new NextResponse(msg, { status: 401 });
  }
}
