import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { mapEfiCobToPaymentStatus } from "@/infra/efi/status/efi-status";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Params = {
  limit?: number;
};

/**
 * Reconcilia cobranças imediatas ad-hoc (Pix Avulso) criadas para líderes.
 */
export async function reconcileAdhocCobs({ limit = 100 }: Params) {
  const pending = await prisma.pixCobImmediate.findMany({
    where: {
      status: { notIn: ["CONCLUIDA", "PAGO", "CANCELADA", "EXPIRADA"] },
      txid: { not: null },
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: pending.length,
    confirmed: 0,
    updated: 0,
    failed: 0,
  };

  for (const item of pending) {
    try {
      if (!item.txid) continue;

      const efiCob = await pixAutoClient.cob.get(item.txid);
      const nextStatus =
        mapEfiCobToPaymentStatus(efiCob.status) || efiCob.status;

      // Se mudou de status, atualiza no banco
      if (nextStatus !== item.status) {
        await prisma.pixCobImmediate.update({
          where: { id: item.id },
          data: {
            status: nextStatus,
            payload: asInputJson(efiCob),
            updatedAt: new Date(),
          },
        });

        if (nextStatus === "PAID" || nextStatus === "CONCLUIDA") {
          stats.confirmed++;
        } else {
          stats.updated++;
        }
      }
    } catch {
      stats.failed++;
    }
  }

  return stats;
}
