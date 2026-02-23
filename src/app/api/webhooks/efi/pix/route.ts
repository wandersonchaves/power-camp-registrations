// src/app/api/webhooks/efi/pix/route.ts
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

function extractTxids(payload: unknown): string[] {
  // A Efí pode enviar arrays; você ainda não colou exemplos,
  // então deixamos robusto:
  // - payload.txid
  // - payload.pix[].txid
  // - payload.pix[0].txid
  if (!payload || typeof payload !== "object") return [];

  const obj = payload as Record<string, unknown>;
  const out = new Set<string>();

  const direct = obj.txid;
  if (typeof direct === "string" && direct.trim()) out.add(direct.trim());

  const pix = obj.pix;
  if (Array.isArray(pix)) {
    for (const item of pix) {
      if (item && typeof item === "object") {
        const txid = (item as Record<string, unknown>).txid;
        if (typeof txid === "string" && txid.trim()) out.add(txid.trim());
      }
    }
  }

  return Array.from(out);
}

async function processPixWebhook(params: {
  kind: string;
  externalId: string;
  payload: unknown;
}) {
  const { kind, externalId, payload } = params;

  // 1) idempotência no inbox
  const created = await prisma.efiWebhookEvent.upsert({
    where: { kind_externalId: { kind, externalId } },
    update: {},
    create: {
      kind,
      externalId,
      payload: asInputJson(payload),
    },
    select: { id: true, processedAt: true },
  });

  // já processado (replay)
  if (created.processedAt) return;

  const txids = extractTxids(payload);
  if (txids.length === 0) {
    // marca como processado mesmo assim (para não ficar reprocessando lixo)
    await prisma.efiWebhookEvent.update({
      where: { id: created.id },
      data: { processedAt: new Date() },
    });
    return;
  }

  // 2) para cada txid, confirma pagamento inicial (transação leve)
  await prisma.$transaction(async (tx) => {
    for (const txid of txids) {
      const attempt = await tx.initialPaymentAttempt.findFirst({
        where: { txid },
        select: {
          enrollmentId: true,
          paidAt: true,
          status: true,
        },
      });

      // se não existe attempt ainda, só ignora (pode chegar antes da criação local)
      if (!attempt) continue;

      // idempotente: já pago
      if (attempt.paidAt) continue;

      await tx.initialPaymentAttempt.update({
        where: { enrollmentId: attempt.enrollmentId },
        data: {
          status: "PAID",
          paidAt: new Date(),
          payload: asInputJson({
            // merge auditável
            ...(typeof payload === "object" && payload ? payload : {}),
            _webhook: {
              kind,
              externalId,
              receivedAt: new Date().toISOString(),
            },
          }),
        },
      });

      await tx.enrollment.update({
        where: { id: attempt.enrollmentId },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
    }

    await tx.efiWebhookEvent.update({
      where: { id: created.id },
      data: { processedAt: new Date() },
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    assertEfiWebhookAllowed(req);

    const payload = await readJsonBody(req);

    const kind = "pix";
    const externalId = sha256Json(payload);

    // processa (rápido); se quiser, dá pra trocar por fila depois
    await processPixWebhook({ kind, externalId, payload });

    // Resposta padrão: string "200" (conforme doc)
    return new NextResponse("200", { status: 200 });
  } catch (err) {
    // IMPORTANTE: você pode preferir responder 200 mesmo com erro de processamento,
    // mas NÃO pode aceitar origem inválida.
    const msg = err instanceof Error ? err.message : "Webhook error";
    return new NextResponse(msg, { status: 401 });
  }
}
