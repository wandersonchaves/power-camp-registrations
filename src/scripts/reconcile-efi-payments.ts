// src/scripts/reconcile-efi-payments.ts
/* eslint-disable no-console */
import type { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import type { CobListResponse, CobResponse } from "@/infra/efi/pix-auto.types";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Kind = "COB" | "COBR" | "REC";

type EfiPixLite = { horario?: string };

type EfiCobLite = Pick<CobResponse, "txid" | "status" | "pix" | "calendario">;

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function must(name: string, v?: string): string {
  if (!v) throw new Error(`Missing --${name}=...`);
  return v;
}

function toIsoOrThrow(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d.toISOString();
}

function upper(v: unknown) {
  return String(v ?? "")
    .toUpperCase()
    .trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function extractPixLite(pix: unknown): EfiPixLite[] {
  if (!Array.isArray(pix)) return [];

  const out: EfiPixLite[] = [];
  for (const item of pix) {
    if (!isRecord(item)) continue;
    const horario =
      typeof item.horario === "string" ? String(item.horario) : undefined;
    out.push({ horario });
  }
  return out;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return asInputJson(value);
}

function isJsonObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getObject(v: unknown): Record<string, unknown> {
  return isJsonObject(v) ? v : {};
}

function getNestedObject(
  parent: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return getObject(parent[key]);
}

async function reconcileCob(params: {
  startIso: string;
  endIso: string;
  itensPorPagina: number;
}) {
  let paginaAtual = 0;

  for (;;) {
    const res: CobListResponse = await pixAutoClient.cob.list({
      inicio: params.startIso,
      fim: params.endIso,
      paginaAtual,
      itensPorPagina: params.itensPorPagina,
    });

    const cobs: EfiCobLite[] = res.cobs ?? [];
    const pag = res.parametros?.paginacao;

    console.log(
      `[COB] page=${paginaAtual} items=${cobs.length} total=${pag?.quantidadeTotalDeItens ?? "?"}`,
    );

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
              status: true,
              payload: true,
            },
          })
        : [];

    const byTxid = new Map(attempts.map((a) => [a.txid, a]));

    for (const cob of cobs) {
      const txid = String(cob.txid ?? "").trim();
      if (!txid) continue;

      const status = upper(cob.status);
      const pixArr = extractPixLite(cob.pix); // ✅ aqui está a correção

      const attempt = byTxid.get(txid);
      if (!attempt) {
        if (pixArr.length > 0) {
          console.warn(
            `[COB] txid=${txid} has PIX but no InitialPaymentAttempt found (skipped).`,
          );
        }
        continue;
      }

      const createdAtEfi =
        cob.calendario &&
        isRecord(cob.calendario) &&
        typeof cob.calendario.criacao === "string"
          ? new Date(String(cob.calendario.criacao))
          : undefined;

      // ✅ Merge de payload sem perder dados anteriores (ticket/rec/etc)
      const currentPayloadObj = getObject(attempt.payload);
      const currentEfiObj = getNestedObject(currentPayloadObj, "efi");
      const nextPayload = toPrismaJson({
        ...currentPayloadObj,
        efi: {
          ...currentEfiObj,
          cob,
          _reconcile: {
            at: new Date().toISOString(),
            source: "GET /v2/cob (list)",
          },
        },
      });

      if (pixArr.length > 0) {
        const pix = pixArr[0];
        const paidAt = pix?.horario ? new Date(pix.horario) : new Date();

        await prisma.$transaction(async (tx) => {
          // idempotente: não re-paga
          const current = await tx.initialPaymentAttempt.findUnique({
            where: { id: attempt.id },
            select: { paidAt: true },
          });
          if (current?.paidAt) return;

          await tx.initialPaymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "PAID",
              paidAt,
              createdAtEfi,
              payload: nextPayload,
            },
          });

          await tx.enrollment.update({
            where: { id: attempt.enrollmentId },
            data: {
              status: "CONFIRMED",
              confirmedAt: paidAt,
            },
          });
        });

        console.log(
          `[COB] reconciled PAID txid=${txid} enrollment=${attempt.enrollmentId} paidAt=${paidAt.toISOString()}`,
        );
      } else {
        const next =
          status === "ATIVA"
            ? "ACTIVE"
            : status === "EXPIRADA"
              ? "EXPIRED"
              : status === "CANCELADA"
                ? "CANCELLED"
                : attempt.status;

        await prisma.initialPaymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: next,
            createdAtEfi,
            payload: nextPayload,
          },
        });

        console.log(`[COB] updated txid=${txid} status=${status} -> ${next}`);
      }
    }

    const totalPages = pag?.quantidadeDePaginas ?? 0;
    if (totalPages === 0) break;
    paginaAtual += 1;
    if (paginaAtual >= totalPages) break;
  }
}

async function main() {
  const kind = (parseArg("kind") ?? "COB") as Kind;
  const startIso = toIsoOrThrow(must("start", parseArg("start")));
  const endIso = toIsoOrThrow(must("end", parseArg("end")));

  const itensPorPagina = Number(parseArg("pageSize") ?? 100);
  if (!Number.isFinite(itensPorPagina) || itensPorPagina <= 0) {
    throw new Error("Invalid --pageSize");
  }

  console.log(
    `[EFI RECONCILE] kind=${kind} start=${startIso} end=${endIso} pageSize=${itensPorPagina}`,
  );

  if (kind === "COB") {
    await reconcileCob({ startIso, endIso, itensPorPagina });
    console.log("[EFI RECONCILE] done");
    return;
  }

  throw new Error(
    `Kind "${kind}" not supported safely right now. Use --kind=COB.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
