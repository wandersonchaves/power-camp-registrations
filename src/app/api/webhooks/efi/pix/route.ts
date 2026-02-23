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

type PixWebhookPayload = {
  pix?: unknown;
  txid?: unknown; // em alguns callbacks pode vir direto
  [k: string]: unknown;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  return null;
}

function parseIsoDate(v: unknown): Date | null {
  const s = pickString(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Extrai txids de forma tolerante:
 * - payload.txid
 * - payload.pix[].txid
 */
function extractTxids(payload: unknown): string[] {
  if (!isObject(payload)) return [];

  const out = new Set<string>();

  const directTxid = pickString(payload.txid);
  if (directTxid) out.add(directTxid);

  const pix = payload.pix;
  if (Array.isArray(pix)) {
    for (const item of pix) {
      if (!isObject(item)) continue;
      const txid = pickString(item.txid);
      if (txid) out.add(txid);
    }
  }

  return Array.from(out);
}

/**
 * Retorna metadata útil do primeiro Pix encontrado para um txid (best-effort).
 * Ajuda a gravar audit (e2eid, horario, valor).
 */
function extractPixMetaForTxid(payload: unknown, txid: string) {
  if (!isObject(payload)) return null;
  const pix = payload.pix;
  if (!Array.isArray(pix)) return null;

  for (const item of pix) {
    if (!isObject(item)) continue;
    const itemTxid = pickString(item.txid);
    if (!itemTxid || itemTxid !== txid) continue;

    const e2eid = pickString(item.endToEndId);
    const paidAt = parseIsoDate(item.horario);
    const valor = pickString(item.valor);

    return { e2eid, paidAt, valor };
  }

  return null;
}

async function confirmInitialPaymentByTxid(params: {
  txid: string;
  payload: unknown;
  kind: string;
  externalId: string;
}) {
  const { txid, payload, kind, externalId } = params;

  const meta = extractPixMetaForTxid(payload, txid);
  const paidAt = meta?.paidAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    /**
     * Atualização idempotente:
     * - só marca como pago se ainda não tiver paidAt.
     * - updateMany é seguro contra concorrência/replays.
     */
    const updated = await tx.initialPaymentAttempt.updateMany({
      where: {
        txid,
        paidAt: null,
        status: { notIn: ["PAID", "CANCELLED", "FAILED", "EXPIRED"] },
      },
      data: {
        status: "PAID",
        paidAt,
        payload: asInputJson({
          // Mantém o payload bruto do webhook (auditoria)
          webhook: payload,
          // Metadata útil (best-effort)
          meta: {
            txid,
            endToEndId: meta?.e2eid ?? null,
            valor: meta?.valor ?? null,
            paidAt: paidAt.toISOString(),
          },
          // Contexto local (troubleshooting)
          _webhook: {
            kind,
            externalId,
            receivedAt: new Date().toISOString(),
          },
        }),
      },
    });

    // Se não atualizou nada, ou já estava pago, ou não existe localmente ainda.
    if (updated.count === 0) return;

    // Como "txid" pode não ser unique no schema, pegamos o enrollmentId do mais recente.
    const attempt = await tx.initialPaymentAttempt.findFirst({
      where: { txid },
      orderBy: { createdAt: "desc" },
      select: { enrollmentId: true },
    });
    if (!attempt) return;

    // Confirma enrollment (idempotente)
    await tx.enrollment.updateMany({
      where: { id: attempt.enrollmentId, status: { not: "CONFIRMED" } },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
  });
}

async function processPixWebhook(params: {
  kind: string;
  externalId: string;
  payload: unknown;
}) {
  const { kind, externalId, payload } = params;

  // 1) Inbox idempotente
  const created = await prisma.efiWebhookEvent.upsert({
    where: { kind_externalId: { kind, externalId } },
    update: {},
    create: { kind, externalId, payload: asInputJson(payload) },
    select: { id: true, processedAt: true },
  });

  if (created.processedAt) return;

  // 2) Extrai txids
  const txids = extractTxids(payload);

  // Mesmo sem txid, marcamos como processado para não ficar reprocessando “lixo”.
  if (txids.length === 0) {
    await prisma.efiWebhookEvent.update({
      where: { id: created.id },
      data: { processedAt: new Date() },
    });
    return;
  }

  // 3) Processa cada txid (confirma pagamento inicial)
  for (const txid of txids) {
    await confirmInitialPaymentByTxid({
      txid,
      payload,
      kind,
      externalId,
    });
  }

  // 4) Marca evento como processado
  await prisma.efiWebhookEvent.update({
    where: { id: created.id },
    data: { processedAt: new Date() },
  });
}

export async function POST(req: NextRequest) {
  // ✅ ACK 200 sempre (exigência prática do fluxo de validação/cadastro da Efí)
  try {
    // 1) Segurança: se falhar, apenas ACK (não processa / não persiste)
    try {
      assertEfiWebhookAllowed(req);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "guard_failed";
      console.error("[EFI webhook pix] unauthorized (ack only)", {
        msg,
        path: req.nextUrl.pathname,
      });
      return new NextResponse("200", { status: 200 });
    }

    // 2) Autorizado → processa
    const payload = (await readJsonBody(req)) as PixWebhookPayload;

    const kind = "webhookpix";
    const externalId = sha256Json(payload);

    await processPixWebhook({ kind, externalId, payload });

    return new NextResponse("200", { status: 200 });
  } catch (err) {
    // ✅ Mesmo erro inesperado: ACK 200 para não quebrar cadastro/entrega
    const msg = err instanceof Error ? err.message : "unknown_error";
    console.error("[EFI webhook pix] unexpected error (ack 200)", { msg });
    return new NextResponse("200", { status: 200 });
  }
}
