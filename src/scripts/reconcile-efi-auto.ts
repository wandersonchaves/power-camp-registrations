import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { extractPixLite } from "@/infra/efi/pix-auto.guards";
import type { CobrListResponse, EfiCobLite } from "@/infra/efi/pix-auto.types";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";
import { syncEfiCobrList } from "@/use-cases/pix-auto/sync-efi-cobr.use-case";
import { reconcilePendingCobs } from "@/use-cases/reconcile/reconcile-pending-cobs.use-case";

function daysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function toEfiIso(d: Date) {
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
            select: { id: true, txid: true, enrollmentId: true, paidAt: true },
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
              payload: asInputJson(cob),
            },
          });

          await tx.enrollment.update({
            where: { id: attempt.enrollmentId },
            data: { status: "CONFIRMED", confirmedAt: new Date() },
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

    const cobrs = res.cobsr || [];
    const pag = res.parametros?.paginacao;

    console.log(`[COBR] page=${paginaAtual} items=${cobrs.length}`);

    if (cobrs.length > 0) {
      const result = await syncEfiCobrList(cobrs);
      console.log(`[COBR] Sync Result:`, result);
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

  try {
    await reconcileCob(start, end);
  } catch (err) {
    console.error("[COB] error", err);
  }

  try {
    await reconcileCobr(start, end);
  } catch (err) {
    console.error("[COBR] error", err);
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
