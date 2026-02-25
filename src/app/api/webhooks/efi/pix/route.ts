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

/**
 * Efí Pix Webhook (Jornada 3 / Pix)
 *
 * Regras práticas:
 * - A Efí valida a URL do webhook fazendo POST durante o cadastro.
 * - Se você responder != 200, ela considera a URL inacessível (falha no cadastro / retries).
 * - Portanto: SEMPRE retornamos "200" com HTTP 200.
 * - Segurança: só processamos/persistimos quando o guard (HMAC/IP allowlist) aprovar.
 *
 * Idempotência:
 * - 1) Inbox por evento: kind + externalId (hash do payload) via upsert.
 * - 2) Idempotência por pagamento: preferimos endToEndId (e2eid), fallback para txid+horario+valor.
 * - 3) UpdateMany com paidAt: null garante idempotência no attempt.
 */

type PixItem = {
  txid?: unknown;
  endToEndId?: unknown;
  horario?: unknown;
  valor?: unknown;
  [k: string]: unknown;
};

type PixWebhookPayload = {
  pix?: unknown;
  txid?: unknown; // pode vir direto em alguns callbacks
  [k: string]: unknown;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function pickString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function parseIsoDate(v: unknown): Date | null {
  const s = pickString(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeNumberString(v: unknown): string | null {
  const s = pickString(v);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
}

/**
 * Extrai items do pix[] com parsing defensivo.
 */
function extractPixItems(payload: unknown): PixItem[] {
  if (!isObject(payload)) return [];
  const pix = (payload as PixWebhookPayload).pix;
  if (!Array.isArray(pix)) return [];
  return pix.filter((x): x is PixItem => isObject(x));
}

/**
 * Extrai txids:
 * - payload.txid
 * - payload.pix[].txid
 */
function extractTxids(payload: unknown): string[] {
  if (!isObject(payload)) return [];

  const out = new Set<string>();

  const direct = pickString((payload as PixWebhookPayload).txid);
  if (direct) out.add(direct);

  for (const item of extractPixItems(payload)) {
    const txid = pickString(item.txid);
    if (txid) out.add(txid);
  }

  return Array.from(out);
}

/**
 * Cria um fingerprint estável por “pagamento Pix”.
 * Preferência:
 * 1) endToEndId (mais forte, globalmente único)
 * 2) fallback: txid + horario + valor (boa o suficiente na prática)
 */
function computePixReceiptId(params: {
  txid: string | null;
  e2eid: string | null;
  paidAtIso: string | null;
  valor: string | null;
}) {
  const base = params.e2eid
    ? `e2eid:${params.e2eid}`
    : `fallback:${params.txid ?? ""}|${params.paidAtIso ?? ""}|${params.valor ?? ""}`;

  // hash curto para guardar/usar como chave sem vazar dados
  return sha256Json({ base }).slice(0, 48);
}

/**
 * Extrai metadados do pix item (preferindo o item que bate com txid).
 */
function extractPixMeta(item: PixItem): {
  txid: string | null;
  e2eid: string | null;
  paidAt: Date | null;
  valor: string | null;
} {
  const txid = pickString(item.txid);
  const e2eid = pickString(item.endToEndId);
  const paidAt = parseIsoDate(item.horario);
  const valor = safeNumberString(item.valor);

  return {
    txid: txid ?? null,
    e2eid: e2eid ?? null,
    paidAt,
    valor: valor ?? null,
  };
}

/**
 * Confirma pagamento inicial associado ao txid, de forma idempotente:
 * - updateMany com filtro paidAt: null evita corrida/replay.
 * - se atualizou, confirma enrollment.
 *
 * Observação importante:
 * - Caso existam múltiplos attempts históricos com o mesmo txid, preferimos:
 *   1) o mais recente com paidAt null
 *   2) se não achar, não faz nada (idempotente)
 */
async function confirmInitialPaymentByTxid(params: {
  txid: string;
  payload: unknown;
  kind: string;
  externalId: string;
  receivedAtIso: string;
  receiptId: string; // fingerprint do pagamento
  meta: { e2eid: string | null; paidAt: Date; valor: string | null };
}) {
  const { txid, payload, kind, externalId, receivedAtIso, receiptId, meta } =
    params;

  // Se webhook não trouxe horário, usamos "agora" como fallback.
  const paidAt = meta.paidAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    // 1) Atualiza attempts “abertos” desse txid
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
          // Mantemos auditoria do payload inteiro (último recebido)
          webhook: payload,
          meta: {
            txid,
            receiptId,
            endToEndId: meta.e2eid ?? null,
            valor: meta.valor ?? null,
            paidAt: paidAt.toISOString(),
          },
          _webhook: {
            kind,
            externalId,
            receivedAt: receivedAtIso,
          },
        }),
      },
    });

    // nada pra atualizar (já pago, não existe localmente, ou status final)
    if (updated.count === 0) return;

    // 2) Encontra o enrollment associado (mais recente)
    const attempt = await tx.initialPaymentAttempt.findFirst({
      where: { txid },
      orderBy: { createdAt: "desc" },
      select: { enrollmentId: true },
    });
    if (!attempt) return;

    // 3) Confirma enrollment (idempotente)
    await tx.enrollment.updateMany({
      where: { id: attempt.enrollmentId, status: { not: "CONFIRMED" } },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
  });
}

/**
 * Processa um webhook:
 * 1) Inbox idempotente por evento (payload hash)
 * 2) Para cada item pix[]:
 *    - calcula receiptId (preferindo e2eid)
 *    - processa (idempotente via updateMany paidAt null)
 * 3) Marca processedAt
 */
async function processPixWebhook(params: {
  kind: string;
  externalId: string;
  payload: unknown;
  receivedAtIso: string;
}) {
  const { kind, externalId, payload, receivedAtIso } = params;

  // 1) Inbox idempotente (evento)
  const inbox = await prisma.efiWebhookEvent.upsert({
    where: { kind_externalId: { kind, externalId } },
    update: {},
    create: { kind, externalId, payload: asInputJson(payload) },
    select: { id: true, processedAt: true },
  });

  if (inbox.processedAt) return;

  // 2) Se tiver pix[], processa por item (melhor que só por txid)
  const items = extractPixItems(payload);

  if (items.length > 0) {
    for (const item of items) {
      const meta = extractPixMeta(item);

      // se não tem txid no item, ainda assim registramos o evento como processado,
      // mas não temos como ligar em initialPaymentAttempt
      const txid = meta.txid;

      const paidAt = meta.paidAt ?? new Date();
      const receiptId = computePixReceiptId({
        txid,
        e2eid: meta.e2eid,
        paidAtIso: meta.paidAt ? meta.paidAt.toISOString() : null,
        valor: meta.valor,
      });

      // Sem txid, não dá pra confirmar attempt, mas não falha o webhook
      if (!txid) continue;

      // Confirma de forma idempotente
      await confirmInitialPaymentByTxid({
        txid,
        payload,
        kind,
        externalId,
        receivedAtIso,
        receiptId,
        meta: { e2eid: meta.e2eid, paidAt, valor: meta.valor },
      });
    }
  } else {
    // 3) Fallback: se não veio pix[], tenta extrair txid direto
    const txids = extractTxids(payload);
    for (const txid of txids) {
      const receiptId = computePixReceiptId({
        txid,
        e2eid: null,
        paidAtIso: null,
        valor: null,
      });

      await confirmInitialPaymentByTxid({
        txid,
        payload,
        kind,
        externalId,
        receivedAtIso,
        receiptId,
        meta: { e2eid: null, paidAt: new Date(), valor: null },
      });
    }
  }

  // 4) Marca processado (mesmo que não tenha txid)
  await prisma.efiWebhookEvent.update({
    where: { id: inbox.id },
    data: { processedAt: new Date() },
  });
}

export async function POST(req: NextRequest) {
  // ✅ ACK 200 sempre
  const receivedAtIso = new Date().toISOString();

  try {
    // 1) Segurança (falhou? ack only)
    try {
      assertEfiWebhookAllowed(req);
    } catch (err) {
      console.error("[EFI webhook pix] unauthorized (ack only)", {
        msg: err instanceof Error ? err.message : "guard_failed",
        path: req.nextUrl.pathname,
      });
      return new NextResponse("200", { status: 200 });
    }

    // 2) Autorizado → processa
    const payload = (await readJsonBody(req)) as PixWebhookPayload;

    const kind = "pix";
    // externalId do EVENTO (payload inteiro)
    const externalId = sha256Json(payload);

    await processPixWebhook({ kind, externalId, payload, receivedAtIso });

    return new NextResponse("200", { status: 200 });
  } catch (err) {
    // ✅ Nunca quebrar o webhook/cadastro
    console.error("[EFI webhook pix] unexpected error (ack 200)", {
      msg: err instanceof Error ? err.message : "unknown_error",
    });
    return new NextResponse("200", { status: 200 });
  }
}
