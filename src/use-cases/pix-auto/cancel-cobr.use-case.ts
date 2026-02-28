// src/use-cases/pix-auto/cancel-cobr.use-case.ts
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

function normalizeTxid(txid: string) {
  const t = String(txid ?? "").trim();
  if (!t) throw new AppError("txid is required", 400, "TXID_REQUIRED");
  return t;
}

export async function cancelCobrUseCase(txid: string) {
  const safeTxid = normalizeTxid(txid);

  const cobr = await prisma.pixAutoCobr.findFirst({
    where: { txid: safeTxid },
  });
  if (!cobr) throw new AppError("Charge not found", 404, "COBR_NOT_FOUND");

  // Idempotência: se já estiver cancelada localmente, retorna
  if (String(cobr.status ?? "").toUpperCase() === "CANCELADA") {
    return cobr;
  }

  // PATCH /v2/cobr/:txid
  const resp = await pixAutoClient.cobr.patch(safeTxid, {
    status: "CANCELADA",
  });

  return prisma.pixAutoCobr.update({
    where: { id: cobr.id },
    data: {
      status: String(resp.status ?? "CANCELADA"),
      payload: asInputJson(resp),
    },
  });
}
