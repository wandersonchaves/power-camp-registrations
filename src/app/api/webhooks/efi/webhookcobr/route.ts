import { type NextRequest, NextResponse } from "next/server";

import {
  assertEfiWebhookAllowed,
  sha256Json,
} from "@/infra/efi/webhooks/efi-webhook.guard";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OK = () => new NextResponse("200", { status: 200 });

async function tryReadJson(req: NextRequest): Promise<unknown | null> {
  try {
    const text = await req.text();
    if (!text?.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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

  // ✅ TODO: quando tiver o shape do callback, atualize PixAutoCobr.status etc.
  await prisma.efiWebhookEvent.update({
    where: { id: created.id },
    data: { processedAt: new Date() },
  });
}

/**
 * ✅ GET/HEAD: ping/validação de acessibilidade
 */
export async function GET() {
  return OK();
}

export async function HEAD() {
  return OK();
}

/**
 * ✅ POST: webhook real (ou teste)
 * Regras:
 * - ACK 200 SEMPRE (evita erro “URL respondeu 401” no cadastro)
 * - Só processa se passar no guard
 */
export async function POST(req: NextRequest) {
  let allowed = false;

  try {
    assertEfiWebhookAllowed(req);
    allowed = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "guard_failed";
    console.error("[EFI webhookcobr] unauthorized (ack only)", {
      msg,
      path: req.nextUrl.pathname,
    });
    allowed = false;
  }

  const payload = await tryReadJson(req);

  // teste/ping sem body → ACK
  if (!payload) return OK();

  // não autorizado → ACK sem processar
  if (!allowed) return OK();

  try {
    await processCobrWebhook({
      kind: "webhookcobr",
      externalId: sha256Json(payload),
      payload,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unexpected_error";
    console.error("[EFI webhookcobr] processing error (ack 200)", { msg });
  }

  return OK();
}
