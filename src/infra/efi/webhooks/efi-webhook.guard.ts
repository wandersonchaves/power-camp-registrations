// src/infra/efi/webhooks/efi-webhook.guard.ts
import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * Guard para webhooks Efí em modo skip-mTLS.
 *
 * Estratégia (ordem):
 * 1) HMAC obrigatório (query ?hmac=... ou header x-webhook-hmac / x-efi-webhook-hmac)
 * 2) (Opcional) allowlist de IPs via EFI_WEBHOOK_ALLOW_IPS
 *
 * Observações (Railway/Cloudflare/proxies):
 * - IP real pode vir em cf-connecting-ip, x-forwarded-for, x-real-ip.
 * - IP allowlist pode ser instável dependendo do proxy/NAT — use como camada extra.
 */

function getClientIp(req: NextRequest): string | null {
  // Cloudflare
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  // Proxies comuns
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;

  const xrip = req.headers.get("x-real-ip");
  if (xrip) return xrip.trim();

  // Fallback (nem sempre existe)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  if (typeof anyReq.ip === "string" && anyReq.ip.trim())
    return anyReq.ip.trim();

  return null;
}

function normalizeAllowIps(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeEqual(a: string, b: string): boolean {
  // timingSafeEqual exige buffers do mesmo tamanho
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function readHmacFromRequest(req: NextRequest): string {
  // 1) query param ?hmac=...
  const url = new URL(req.url);
  const hmacQuery = url.searchParams.get("hmac");
  if (hmacQuery) return String(hmacQuery).trim();

  // 2) header (opcional)
  const hmacHeader =
    req.headers.get("x-webhook-hmac") ?? req.headers.get("x-efi-webhook-hmac");
  if (hmacHeader) return String(hmacHeader).trim();

  return "";
}

/**
 * Valida se o webhook é da Efí (skip-mTLS mode) usando:
 * - HMAC (obrigatório)
 * - (Opcional) allowlist de IPs (EFI_WEBHOOK_ALLOW_IPS)
 *
 * Se falhar, lança Error.
 */
export function assertEfiWebhookAllowed(req: NextRequest) {
  // --- 1) HMAC obrigatório ---
  const expected = String(process.env.EFI_WEBHOOK_HMAC ?? "").trim();
  if (!expected) {
    throw new Error(
      "EFI_WEBHOOK_HMAC não definido no ambiente. Defina e cadastre o webhook com ?hmac=SEU_VALOR&ignorar=.",
    );
  }

  const received = readHmacFromRequest(req);
  if (!received) {
    throw new Error(
      "Webhook rejeitado: hmac ausente. Cadastre a URL do webhook com ?hmac=... (ex: .../webhookrec?hmac=XYZ&ignorar=).",
    );
  }

  if (!safeEqual(received, expected)) {
    throw new Error("Webhook rejeitado: hmac inválido.");
  }

  // --- 2) IP allowlist (opcional) ---
  const allowIpsRaw = String(process.env.EFI_WEBHOOK_ALLOW_IPS ?? "").trim();
  if (allowIpsRaw) {
    const allowIps = normalizeAllowIps(allowIpsRaw);

    // permite desativar explicitamente com "*" (útil em staging)
    const disabled = allowIps.length === 1 && allowIps[0] === "*";
    if (!disabled) {
      const ip = getClientIp(req);
      if (!ip) {
        throw new Error("Webhook rejeitado: não foi possível determinar o IP.");
      }
      if (!allowIps.includes(ip)) {
        throw new Error(`Webhook rejeitado: IP não permitido (${ip}).`);
      }
    }
  }
}

export async function readJsonBody(req: NextRequest): Promise<unknown> {
  // Route handlers suportam req.json() diretamente
  return req.json();
}

export function sha256Json(value: unknown): string {
  const raw = JSON.stringify(value);
  return crypto.createHash("sha256").update(raw).digest("hex");
}
