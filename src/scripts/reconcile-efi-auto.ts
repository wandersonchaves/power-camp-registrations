// src/scripts/reconcile-efi-auto.ts
/* eslint-disable no-console */
import type { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { extractPixLite } from "@/infra/efi/pix-auto.guards";
import type {
  CobrListResponse,
  CobrResponse,
  EfiCobLite,
} from "@/infra/efi/pix-auto.types";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";
import { reconcilePendingCobs } from "@/use-cases/reconcile/reconcile-pending-cobs.use-case";

type EfiCobrLite = Pick<CobrResponse, "txid" | "status" | "pix">;

function daysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function upper(v: unknown) {
  return String(v ?? "")
    .toUpperCase()
    .trim();
}

/**
 * Prisma Json fields NÃO aceitam `unknown`.
 * Garanta `Prisma.InputJsonValue` via asInputJson (helper do seu projeto).
 */
function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return asInputJson(value);
}

function getCobrsFromListResponse(res: CobrListResponse): EfiCobrLite[] {
  // Compat: alguns retornos usam `cobsr`, outros `cobrs`.
  // Fazemos narrowing por "in" com unknown.
  const asAny = res as unknown as Record<string, unknown>;

  const cobsr = asAny["cobsr"];
  if (Array.isArray(cobsr)) return cobsr as EfiCobrLite[];

  const cobrs = asAny["cobrs"];
  if (Array.isArray(cobrs)) return cobrs as EfiCobrLite[];

  return [];
}

function toEfiIso(d: Date) {
  // remove milissegundos: 2026-02-28T09:47:30Z
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function reconcileCob(startIso: string, endIso: string) {
  let paginaAtual = 0;
  const itensPorPagina = 100;

  for (;;) {
    const res = await pixAutoClient.cob.list({
      inicio: toEfiIso(new Date(startIso)),
      fim: toEfiIso(new Date(endIso)),
      "paginacao.paginaAtual": paginaAtual,
      "paginacao.itensPorPagina": itensPorPagina,
    });

    const cobs: EfiCobLite[] = res.cobs ?? [];
    const pag = res.parametros?.paginacao;

    console.log(`[COB] page=${paginaAtual} items=${cobs.length}`);

    const txids = cobs.map((c) => String(c.txid ?? "").trim()).filter(Boolean);

    const attempts =
      txids.length > 0
        ? await prisma.initialPaymentAttempt.findMany({
            where: { txid: { in: txids } },
            select: {
              id: true,
              txid: true,
              enrollmentId: true,
              paidAt: true,
            },
          })
        : [];

    const byTxid = new Map(attempts.map((a) => [a.txid, a]));

    for (const cob of cobs) {
      const txid = String(cob.txid ?? "").trim();
      if (!txid) continue;

      const pixArr = extractPixLite(cob.pix);
      const attempt = byTxid.get(txid);
      if (!attempt) continue;

      if (pixArr.length > 0) {
        const pix = pixArr[0];
        const paidAt = pix?.horario ? new Date(pix.horario) : new Date();

        await prisma.$transaction(async (tx) => {
          await tx.initialPaymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "PAID",
              paidAt: attempt.paidAt ?? paidAt,
              payload: toPrismaJson(cob), // ✅ Prisma InputJsonValue
            },
          });

          await tx.enrollment.update({
            where: { id: attempt.enrollmentId },
            data: {
              status: "CONFIRMED",
              confirmedAt: new Date(),
            },
          });
        });

        console.log(`[COB] PAID reconciled txid=${txid}`);
      }
    }

    const totalPages = pag?.quantidadeDePaginas ?? 0;
    paginaAtual += 1;
    if (paginaAtual >= totalPages) break;
  }
}

async function reconcileCobr(startIso: string, endIso: string) {
  let paginaAtual = 0;
  const itensPorPagina = 100;

  for (;;) {
    const res: CobrListResponse = await pixAutoClient.cobr.list({
      inicio: toEfiIso(new Date(startIso)),
      fim: toEfiIso(new Date(endIso)),
      "paginacao.paginaAtual": paginaAtual,
      "paginacao.itensPorPagina": itensPorPagina,
    });

    const cobrs = getCobrsFromListResponse(res);
    const pag = res.parametros?.paginacao;

    console.log(`[COBR] page=${paginaAtual} items=${cobrs.length}`);

    const txids = cobrs.map((c) => String(c.txid ?? "").trim()).filter(Boolean);

    const localCharges =
      txids.length > 0
        ? await prisma.pixAutoCobr.findMany({
            where: { txid: { in: txids } },
            select: { id: true, txid: true },
          })
        : [];

    const byTxid = new Map(localCharges.map((c) => [String(c.txid ?? ""), c]));

    for (const cobr of cobrs) {
      const txid = String(cobr.txid ?? "").trim();
      if (!txid) continue;

      const pixArr = extractPixLite(cobr.pix);
      const local = byTxid.get(txid);
      if (!local) continue;

      await prisma.pixAutoCobr.update({
        where: { id: local.id },
        data: {
          status: upper(cobr.status),
          payload: toPrismaJson(cobr), // ✅ Prisma InputJsonValue
        },
      });

      if (pixArr.length > 0) {
        console.log(`[COBR] PAID reconciled txid=${txid}`);
      }
    }

    const totalPages = pag?.quantidadeDePaginas ?? 0;
    paginaAtual += 1;
    if (paginaAtual >= totalPages) break;
  }
}

async function main() {
  const start = daysAgo(30);
  const end = new Date().toISOString();

  console.log("==== EFI WEEKLY RECONCILIATION START ====");
  console.log(`Window: ${start} → ${end}`);

  await reconcileCob(start, end);
  try {
    await reconcileCobr(start, end);
  } catch (err) {
    console.error("[COBR] skipped due to error", err);
  }

  console.log("==== CHECKING REMAINING PENDING COBS ====");
  const pendingResults = await reconcilePendingCobs({ limit: 500 });
  console.log("[PENDING]", pendingResults);

  console.log("==== EFI WEEKLY RECONCILIATION DONE ====");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
