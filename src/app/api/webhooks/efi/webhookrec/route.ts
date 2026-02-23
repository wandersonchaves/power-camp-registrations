// src/app/api/webhooks/efi/webhookrec/route.ts
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

/**
 * OBS importante:
 * - A Efí valida a URL do webhookrec chamando sua rota (POST) durante o cadastro.
 * - Se você responder 401, o cadastro falha com "URL inacessível".
 * - Por isso, este handler SEMPRE responde 200.
 * - Segurança: só processa / persiste se passar no guard.
 */

async function processRecWebhook(params: {
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

  // ✅ TODO: aqui você atualiza PixAutoRecurrence / PixAutoCobr etc.
  // Por enquanto: marca como processado (audit trail)
  await prisma.efiWebhookEvent.update({
    where: { id: created.id },
    data: { processedAt: new Date() },
  });
}

export async function POST(req: NextRequest) {
  // ✅ NUNCA devolva 401 aqui, senão a Efí considera "URL inacessível"
  // (o cadastro do webhookrec falha).
  try {
    // 1) Primeiro: valida segurança (se falhar, a gente NÃO processa)
    try {
      assertEfiWebhookAllowed(req);
    } catch (err) {
      // ✅ Aceita handshake/teste da Efí sem quebrar o cadastro
      // ✅ Segurança: não persiste nada quando não autorizado
      const msg = err instanceof Error ? err.message : "guard_failed";
      console.error("[EFI webhookrec] unauthorized (ack only)", {
        msg,
        path: req.nextUrl.pathname,
      });

      return new NextResponse("200", { status: 200 });
    }

    // 2) Autorizado → processa payload normalmente
    const payload = await readJsonBody(req);

    await processRecWebhook({
      kind: "webhookrec",
      externalId: sha256Json(payload),
      payload,
    });

    return new NextResponse("200", { status: 200 });
  } catch (err) {
    // ✅ Mesmo erro inesperado: ack 200 para evitar retries infinitos no cadastro
    // Você ainda vê o erro no log e corrige sem derrubar o webhook.
    const msg = err instanceof Error ? err.message : "unknown_error";
    console.error("[EFI webhookrec] unexpected error (ack 200)", { msg });

    return new NextResponse("200", { status: 200 });
  }
}
