// src/lib/auth/cron-secret.ts
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (v: string) => createHash("sha256").update(v).digest();

/**
 * Valida `Authorization: Bearer <CRON_SECRET>` em tempo constante.
 * Sem CRON_SECRET configurado, nega sempre (fail closed).
 */
export function isValidCronAuthorization(
  header: string | null,
  secret = process.env.CRON_SECRET,
): boolean {
  if (!secret || !header) return false;
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  // Hash antes de comparar: tamanho fixo, sem vazar o comprimento do segredo.
  return timingSafeEqual(digest(match[1]), digest(secret));
}
