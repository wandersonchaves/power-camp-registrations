// src/infra/efi/webhooks/efi-webhook.guard.ts
import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * Observações (Railway/Cloudflare):
 * - O IP real pode vir em x-forwarded-for (primeiro da lista).
 * - Em alguns cenários o IP pode não bater (NAT/proxy). Por isso:
 *   - IP allowlist é opcional
 *   - HMAC é o principal fator de validação (recomendado)
 */

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    return first || null;
  }
  return req.headers.get("x-real-ip") ?? null;
}

function normalizeAllowIps(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeEqual(a: string, b: string): boolean {
  // timingSafeEqual exige buffers do mesmo tamanho
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function readHmacFromRequest(req: NextRequest): string {
  // 1) query param ?hmac=...
  const url = new URL(req.url);
  const hmacQuery = url.searchParams.get("hmac");
  if (hmacQuery) return String(hmacQuery).trim();

  // 2) header (opcional, caso você queira migrar depois)
  const hmacHeader =
    req.headers.get("x-webhook-hmac") ?? req.headers.get("x-efi-webhook-hmac");
  if (hmacHeader) return String(hmacHeader).trim();

  return "";
}

/**
 * Valida se o webhook é da Efí (skip-mTLS mode) usando:
 * - HMAC na URL (recomendado)
 * - (Opcional) allowlist de IPs (pode ser instável em plataformas com proxy)
 *
 * Se falhar, lança Error.
 * O handler (route.ts) deve decidir se:
 * - responde 200 (ack) e ignora processamento
 * - ou responde 401/403 (NÃO recomendado para cadastro na Efí)
 */
export function assertEfiWebhookAllowed(req: NextRequest) {
  // --- 1) HMAC ---
  const expected = String(process.env.EFI_WEBHOOK_HMAC ?? "").trim();

  if (!expected) {
    // Em produção, eu recomendo FORTEMENTE definir.
    // Sem isso, você fica sem autenticação da origem no modo skip-mTLS.
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

  // --- 2) IP Allowlist (opcional) ---
  const allowIpsRaw = String(process.env.EFI_WEBHOOK_ALLOW_IPS ?? "").trim();
  if (allowIpsRaw) {
    const allowIps = normalizeAllowIps(allowIpsRaw);

    // permite desativar explicitamente com "*" (útil em staging)
    if (!(allowIps.length === 1 && allowIps[0] === "*")) {
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
  return req.json();
}

export function sha256Json(value: unknown): string {
  const raw = JSON.stringify(value);
  return crypto.createHash("sha256").update(raw).digest("hex");
}
