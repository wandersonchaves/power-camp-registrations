import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { mapEfiCobToPaymentStatus } from "@/infra/efi/status/efi-status";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Params = {
  limit?: number;
  concurrency?: number; // evita martelar EFI e evita saturar lambda
};

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 1) return arr.map((x) => [x]);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function reconcilePendingCobs({
  limit = 200,
  concurrency = 5,
}: Params) {
  // ✅ busca mínima (performance)
  const pending = await prisma.initialPaymentAttempt.findMany({
    where: {
      paidAt: null,
      txid: { not: "" },
      status: { in: ["CREATED", "ACTIVE"] },
    },
    select: { enrollmentId: true, txid: true, status: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let confirmed = 0;
  let stillActive = 0;
  let updatedStatusOnly = 0;
  let failed = 0;

  // ✅ paralelismo controlado
  for (const batch of chunk(pending, Math.max(1, concurrency))) {
    await Promise.all(
      batch.map(async (item) => {
        try {
          const txid = String(item.txid ?? "").trim();
          if (!txid) return;

          // ✅ source of truth: GET /v2/cob/:txid
          const cob = await pixAutoClient.cob.get(txid);
          const nextStatus =
            mapEfiCobToPaymentStatus(String(cob.status ?? "")) ?? "ACTIVE";

          if (nextStatus === "PAID") {
            // ✅ idempotente (não confirma duas vezes)
            await prisma.$transaction(async (tx) => {
              const current = await tx.initialPaymentAttempt.findUnique({
                where: { enrollmentId: item.enrollmentId },
                select: { paidAt: true },
              });
              if (current?.paidAt) return;

              await tx.initialPaymentAttempt.update({
                where: { enrollmentId: item.enrollmentId },
                data: {
                  status: "PAID",
                  paidAt: new Date(),
                  payload: asInputJson({
                    cob,
                    _reconcile: {
                      at: new Date().toISOString(),
                      source: "GET /v2/cob/:txid",
                    },
                  }),
                },
              });

              await tx.enrollment.update({
                where: { id: item.enrollmentId },
                data: { status: "CONFIRMED", confirmedAt: new Date() },
              });
            });

            confirmed += 1;
            return;
          }

          // não pago ainda
          stillActive += 1;

          if (nextStatus !== item.status) {
            await prisma.initialPaymentAttempt.update({
              where: { enrollmentId: item.enrollmentId },
              data: {
                status: nextStatus,
                payload: asInputJson({
                  cob,
                  _reconcile: {
                    at: new Date().toISOString(),
                    source: "GET /v2/cob/:txid",
                  },
                }),
              },
            });
            updatedStatusOnly += 1;
          }
        } catch (err) {
          if (pixAutoClient.errors.isNotFound(err)) {
            // Se não existe na Efí e já tem mais de 7 dias, cancelamos localmente
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const record = await prisma.initialPaymentAttempt.findUnique({
              where: { enrollmentId: item.enrollmentId },
              select: { createdAt: true },
            });

            if (record && record.createdAt < sevenDaysAgo) {
              await prisma.initialPaymentAttempt.update({
                where: { enrollmentId: item.enrollmentId },
                data: {
                  status: "CANCELLED",
                  payload: asInputJson({
                    _reconcile: {
                      at: new Date().toISOString(),
                      error: "cobranca_nao_encontrada",
                      action: "AUTO_CANCEL_OLD_ORPHAN",
                    },
                  }),
                },
              });
              updatedStatusOnly += 1;
            }
          }

          failed += 1;

          // opcional: você pode persistir erro no payload pra auditoria
          await prisma.initialPaymentAttempt
            .update({
              where: { enrollmentId: item.enrollmentId },
              data: {
                payload: asInputJson({
                  _reconcileError: {
                    at: new Date().toISOString(),
                    txid: item.txid,
                    message: err instanceof Error ? err.message : String(err),
                  },
                }),
              },
            })
            .catch(() => {});
        }
      }),
    );
  }

  return {
    checked: pending.length,
    confirmed,
    stillActive,
    updatedStatusOnly,
    failed,
  };
}
