// src/infra/efi/wait-for-cob-active.ts
import { assertValidTxid } from "@/infra/efi/txid";
import { log } from "@/lib/logger";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type WaitForCobActiveOptions = {
  /** Quantas tentativas (cada uma com sleep/backoff). */
  maxAttempts?: number;

  /** Delay inicial. */
  baseDelayMs?: number;

  /** Teto do backoff. */
  maxDelayMs?: number;

  /** Fator multiplicador. default: 1.6 */
  multiplier?: number;

  /** Jitter aleatório. */
  jitterMs?: number;

  /** Log prefix custom (opcional). */
  label?: string;

  /** Não logar (útil em loops). */
  quiet?: boolean;

  /**
   * Budget total em ms. Se estourar, sai cedo.
   * (No fluxo “puro” não confirmamos status real; é só gate de tempo.)
   */
  maxTotalMs?: number;

  /**
   * Cache TTL (ms) para não rodar o gate repetidamente para o mesmo txid
   * dentro de um curto período.
   */
  dedupeTtlMs?: number;

  /**
   * Compatibilidade: pode existir em callsites antigos.
   * Aqui é ignorado (não há GET /cob no gate).
   */
  acceptPaidAsUsable?: boolean;
};

type GateEntry = { promise: Promise<void>; expiresAt: number };

/**
 * Cache em memória (por processo) para deduplicar propagation gate por txid.
 * - Em serverless pode reiniciar; ainda assim ajuda por request/concurrency.
 */
const gateCache = new Map<string, GateEntry>();

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function waitForCobActive(
  txid: string,
  opts?: WaitForCobActiveOptions,
) {
  const safeTxid = String(txid ?? "").trim();
  assertValidTxid(safeTxid);

  const maxAttempts = clamp(opts?.maxAttempts ?? 3, 1, 12); // ✅ default menor
  const baseDelayMs = clamp(opts?.baseDelayMs ?? 200, 0, 30_000);
  const maxDelayMs = clamp(opts?.maxDelayMs ?? 900, 0, 60_000);
  const multiplier = clamp(opts?.multiplier ?? 1.6, 1.0, 4.0);
  const jitterMs = clamp(opts?.jitterMs ?? 120, 0, 5_000);
  const label = opts?.label ?? "[EFI COB] propagation";
  const quiet = opts?.quiet ?? false;

  const maxTotalMs = clamp(opts?.maxTotalMs ?? 3_500, 0, 120_000); // ✅ budget curto
  const dedupeTtlMs = clamp(opts?.dedupeTtlMs ?? 10_000, 0, 300_000);

  // 1) Dedupe por txid (TTL)
  const now = Date.now();
  const cached = gateCache.get(safeTxid);
  if (cached && cached.expiresAt > now) return cached.promise;

  // 2) Cria promise “shared” e salva no cache antes de rodar
  const promise = (async () => {
    const start = Date.now();
    let delay = baseDelayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const elapsed = Date.now() - start;
      if (elapsed >= maxTotalMs) {
        if (!quiet) {
          log("info", label, {
            txid: safeTxid,
            attempt,
            maxAttempts,
            budgetMs: maxTotalMs,
            elapsedMs: elapsed,
            note: "budget_exceeded",
          });
        }
        return;
      }

      const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
      const ms = Math.min(maxDelayMs, Math.floor(delay) + jitter);

      if (!quiet) {
        log("info", label, {
          txid: safeTxid,
          attempt,
          maxAttempts,
          sleepMs: ms,
        });
      }

      if (ms > 0) await sleep(ms);
      delay *= multiplier;
    }
  })();

  gateCache.set(safeTxid, { promise, expiresAt: now + dedupeTtlMs });
  return promise;
}
