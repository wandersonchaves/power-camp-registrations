// src/use-cases/pix-auto/cancel-cobr.use-case.ts
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { AppError } from "@/lib/http-errors";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

export async function cancelCobrUseCase(txid: string) {
  const cob = await prisma.pixAutoCobr.findFirst({ where: { txid } });
  if (!cob) throw new AppError("Charge not found", 404, "COBR_NOT_FOUND");

  const resp = await pixAutoClient.cobr.patch(txid, { status: "CANCELADA" });

  return prisma.pixAutoCobr.update({
    where: { id: cob.id },
    data: {
      status: resp.status ?? "CANCELADA",
      payload: asInputJson(resp),
    },
  });
}
