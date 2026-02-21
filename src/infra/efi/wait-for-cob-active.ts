// src/infra/efi/wait-for-cob-active.ts
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { assertValidTxid } from "@/infra/efi/txid";
import { log } from "@/lib/logger";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type CobLike = { status?: unknown };

export async function waitForCobActive(
  txid: string,
  opts?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    getCob?: (txid: string) => Promise<CobLike>;
  },
) {
  assertValidTxid(txid);

  const maxAttempts = opts?.maxAttempts ?? 8;
  const baseDelayMs = opts?.baseDelayMs ?? 150;
  const maxDelayMs = opts?.maxDelayMs ?? 1500;

  const getCob = opts?.getCob ?? ((t: string) => pixAutoClient.cob.get(t));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const cob = await getCob(txid);
    const status = String(cob.status ?? "").toUpperCase();

    // log só a cada tentativa, mas sem payload
    log("info", "[EFI COB] poll", { txid, attempt, status });

    if (status.includes("ATIV")) return;

    // backoff linear com teto (simples e suficiente aqui)
    const delay = Math.min(maxDelayMs, baseDelayMs * attempt);
    await sleep(delay);
  }

  throw new Error(`COB não ficou ATIVA a tempo (txid=${txid}).`);
}
