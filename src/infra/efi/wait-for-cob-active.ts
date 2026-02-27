// src/infra/efi/wait-for-cob-active.ts
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { assertValidTxid } from "@/infra/efi/txid";
import { log } from "@/lib/logger";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type WaitForCobActiveOptions = {
  /** Quantas tentativas (cada uma com backoff + GET /v2/cob/:txid). */
  maxAttempts?: number;

  /** Delay inicial. */
  baseDelayMs?: number;

  /** Teto do backoff. */
  maxDelayMs?: number;

  /** Fator multiplicador. default: 1.6 */
  multiplier?: number;

  /** Jitter aleatório (0..jitterMs). */
  jitterMs?: number;

  /** Log prefix custom (opcional). */
  label?: string;

  /** Não logar (útil em loops). */
  quiet?: boolean;

  /**
   * Budget total em ms. Se estourar, sai cedo.
   * (retorna sem lançar; o caller decide)
   */
  maxTotalMs?: number;

  /**
   * Cache TTL (ms) para não rodar o gate repetidamente para o mesmo txid
   * dentro de um curto período.
   */
  dedupeTtlMs?: number;

  /**
   * TTL do cache interno de GET /cob (dedupe de I/O).
   * Se você já tem getCached no client, isso reduz ainda mais chamadas.
   */
  getCacheTtlMs?: number;

  /**
   * ✅ A Jornada 3 exige ATIVA. Porém, em outros fluxos, talvez você aceite "CONCLUIDA"
   * como "ok" (ex: reconciliação). Aqui default é false.
   */
  acceptPaidAsUsable?: boolean;

  /**
   * ✅ Consistência eventual do /v2/rec:
   * mesmo com /v2/cob ATIVA, o /v2/rec pode demorar um pouco pra aceitar.
   * Este parâmetro força uma idade mínima (ms) desde a criação da COB antes de "liberar".
   */
  minCobAgeMs?: number;

  /**
   * ✅ Exigir N leituras consecutivas com status ATIVA (reduz instabilidade).
   */
  requireConsecutiveActiveReads?: number;
};

type GateEntry = { promise: Promise<void>; expiresAt: number };

/**
 * Cache em memória (por processo) para deduplicar o gate por txid.
 * - Em serverless pode reiniciar; ainda assim ajuda por request/concurrency.
 */
const gateCache = new Map<string, GateEntry>();

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseEfiCriacaoMs(cob: unknown): number | null {
  if (!cob || typeof cob !== "object") return null;
  const c = cob as { calendario?: { criacao?: unknown } };
  const raw = c.calendario?.criacao;
  const iso = typeof raw === "string" ? raw : "";
  if (!iso) return null;

  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function isStatusActive(status: unknown) {
  return (
    String(status ?? "")
      .toUpperCase()
      .trim() === "ATIVA"
  );
}

/**
 * ✅ Gate real:
 * - faz GET /v2/cob/:txid (dedupe curto)
 * - valida status
 * - exige idade mínima (propagação para /v2/rec)
 * - exige leituras consecutivas ATIVA (opcional)
 * - respeita budget e backoff
 */
export async function waitForCobActive(
  txid: string,
  opts?: WaitForCobActiveOptions,
) {
  const safeTxid = String(txid ?? "").trim();
  assertValidTxid(safeTxid);

  const maxAttempts = clamp(opts?.maxAttempts ?? 8, 1, 20);
  const baseDelayMs = clamp(opts?.baseDelayMs ?? 250, 0, 30_000);
  const maxDelayMs = clamp(opts?.maxDelayMs ?? 2_500, 0, 60_000);
  const multiplier = clamp(opts?.multiplier ?? 1.6, 1.0, 4.0);
  const jitterMs = clamp(opts?.jitterMs ?? 180, 0, 5_000);
  const label = opts?.label ?? "[EFI COB] wait-active";
  const quiet = opts?.quiet ?? false;

  const maxTotalMs = clamp(opts?.maxTotalMs ?? 18_000, 0, 180_000);
  const dedupeTtlMs = clamp(opts?.dedupeTtlMs ?? 8_000, 0, 300_000);

  const getCacheTtlMs = clamp(opts?.getCacheTtlMs ?? 1_250, 0, 10_000);

  const acceptPaidAsUsable = Boolean(opts?.acceptPaidAsUsable ?? false);

  // 🔥 Esse é o pulo do gato pra /v2/rec:
  // tempo mínimo desde criacao da COB antes de "liberar".
  // (ajuda muito quando /rec ainda "não enxerga" a COB como ATIVA)
  const minCobAgeMs = clamp(opts?.minCobAgeMs ?? 1_500, 0, 30_000);

  // Leituras consecutivas ATIVA (default 2 pra dar estabilidade)
  const requireConsecutiveActiveReads = clamp(
    opts?.requireConsecutiveActiveReads ?? 2,
    1,
    5,
  );

  // 1) Dedupe por txid (TTL)
  const now = Date.now();
  const cached = gateCache.get(safeTxid);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = (async () => {
    const start = Date.now();
    let delay = baseDelayMs;

    let consecutiveActive = 0;
    let cobCreatedAtMs: number | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const elapsed = Date.now() - start;
      if (elapsed >= maxTotalMs) {
        if (!quiet) {
          log("warn", label, {
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

      // 2) GET /v2/cob/:txid (com dedupe curto)
      let cob: Awaited<ReturnType<typeof pixAutoClient.cob.get>> | null = null;
      try {
        cob = await pixAutoClient.cob.getCached(safeTxid, {
          dedupeTtlMs: getCacheTtlMs,
        });
      } catch (err) {
        // erro de rede/5xx: não “morre” o fluxo, apenas backoff
        if (!quiet) {
          log("warn", label, {
            txid: safeTxid,
            attempt,
            maxAttempts,
            note: "get_cob_failed",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const status = cob ? String(cob.status ?? "") : "";
      const isActive = cob ? isStatusActive(cob.status) : false;

      // pega criacao uma vez (se vier)
      if (cob && cobCreatedAtMs == null) {
        cobCreatedAtMs = parseEfiCriacaoMs(cob);
      }

      // 3) Abort cedo se status terminal e não usável
      if (
        cob &&
        pixAutoClient.errors.cob.isTerminalNotUsableStatus(cob.status)
      ) {
        // Se algum fluxo quiser aceitar pago como "usável", respeita isso
        if (
          acceptPaidAsUsable &&
          String(cob.status ?? "")
            .toUpperCase()
            .trim() === "CONCLUIDA"
        ) {
          if (!quiet) {
            log("info", label, {
              txid: safeTxid,
              attempt,
              status,
              note: "paid_accepted_as_usable",
            });
          }
          return;
        }

        if (!quiet) {
          log("warn", label, {
            txid: safeTxid,
            attempt,
            status,
            note: "terminal_not_usable",
          });
        }
        return; // caller vai revalidar e lançar AppError com contexto
      }

      // 4) Se ATIVA, aplica regras de estabilidade + idade mínima
      if (cob && isActive) {
        consecutiveActive += 1;

        // idade mínima (ajuda /v2/rec)
        const createdBase = cobCreatedAtMs ?? start;
        const ageMs = Date.now() - createdBase;

        if (!quiet) {
          log("info", label, {
            txid: safeTxid,
            attempt,
            status,
            consecutiveActive,
            requiredConsecutive: requireConsecutiveActiveReads,
            cobAgeMs: ageMs,
            minCobAgeMs,
            note: "active_seen",
          });
        }

        const okConsecutive =
          consecutiveActive >= requireConsecutiveActiveReads;
        const okAge = ageMs >= minCobAgeMs;

        if (okConsecutive && okAge) {
          return;
        }
      } else {
        // reseta estabilidade se não for ATIVA
        consecutiveActive = 0;

        if (!quiet) {
          log("info", label, {
            txid: safeTxid,
            attempt,
            status: status || "(unknown)",
            note: "not_active_yet",
          });
        }
      }

      // 5) backoff + jitter
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
      const ms = Math.min(maxDelayMs, Math.floor(delay) + jitter);

      if (!quiet) {
        log("info", label, {
          txid: safeTxid,
          attempt,
          maxAttempts,
          sleepMs: ms,
          status: status || undefined,
        });
      }

      if (ms > 0) await sleep(ms);
      delay *= multiplier;
    }
  })();

  gateCache.set(safeTxid, { promise, expiresAt: now + dedupeTtlMs });
  return promise;
}
