// src/infra/efi/wait-for-cob-active.ts
import { pixAutoClient } from "./pix-auto.client";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const ACTIVE_STATUSES = new Set<string>(["ATIVA"]);
const FINAL_BAD_STATUSES = new Set<string>([
  "REMOVIDA_PELO_USUARIO_RECEBEDOR",
  "REMOVIDA_PELO_PSP",
  "CANCELADA",
]);

export async function waitForCobActive(
  txid: string,
): Promise<{ status: string }> {
  const maxMs = 10_000;
  const start = Date.now();

  let attempt = 0;

  while (Date.now() - start < maxMs) {
    attempt += 1;

    const cob = await pixAutoClient.cob.get(txid);
    const status = String(cob.status ?? "").toUpperCase();

    console.log(`[EFI COB] txid=${txid} attempt=${attempt} status=${status}`);

    if (ACTIVE_STATUSES.has(status)) return { status };

    if (FINAL_BAD_STATUSES.has(status)) {
      throw new Error(
        `Cobrança entrou em status final inválido para Jornada 3: ${status}`,
      );
    }

    const delay = Math.min(1500, 200 + attempt * 150);
    await sleep(delay);
  }

  const last = await pixAutoClient.cob.get(txid);
  throw new Error(
    `Timeout aguardando cobrança ficar ATIVA. Status final: ${String(last.status ?? "")}`,
  );
}
