import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { prisma } from "@/lib/prisma";
import { syncEfiCobrList } from "@/use-cases/pix-auto/sync-efi-cobr.use-case";

type Params = {
  limit?: number;
};

/**
 * Reconcilia cobranças recorrentes (Pix Automático) que ainda não estão pagas,
 * fazendo um GET individual para cada uma. Isso garante a atualização mesmo
 * que a cobrança tenha sido criada fora da janela de listagem.
 */
export async function reconcilePendingCobsr({ limit = 100 }: Params) {
  const pending = await prisma.pixAutoCobr.findMany({
    where: {
      status: {
        notIn: [
          "CONCLUIDA",
          "PAGO",
          "CANCELADA",
          "REMOVIDA_PELO_USUARIO_RECEBEDOR",
        ],
      },
      txid: { not: null },
    },
    take: limit,
    orderBy: { updatedAt: "asc" }, // Tenta atualizar as mais antigas primeiro
  });

  if (pending.length === 0) return { checked: 0, updated: 0, failed: 0 };

  // Reusamos o syncEfiCobrList, mas passando um array de resultados individuais de GET
  const efiResults: unknown[] = [];
  let failed = 0;

  for (const item of pending) {
    try {
      if (!item.txid) continue;
      const res = await pixAutoClient.cobr.get(item.txid);
      efiResults.push(res);
    } catch {
      failed++;
    }
  }

  const syncResult = await syncEfiCobrList(efiResults);

  return {
    checked: pending.length,
    updated: syncResult.updated,
    failed: failed + syncResult.errors,
  };
}
