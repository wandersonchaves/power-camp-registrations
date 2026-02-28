import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { mapEfiCobToPaymentStatus } from "@/infra/efi/status/efi-status";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

type Params = {
  // janela de reconciliação
  inicioISO: string; // ex: 2026-02-25T00:00:00Z
  fimISO: string; // ex: 2026-02-25T23:59:59Z

  // limites/controle
  pageSize?: number;

  // o que reconciliar
  reconcileInitialCob?: boolean; // /v2/cob
  reconcileRecurringCobr?: boolean; // /v2/cobr

  // opcional: restringir recorrentes a um idRec específico
  idRec?: string;
};

async function* paginate<T>(
  fn: (
    page: number,
    pageSize: number,
  ) => Promise<{
    paginacao: { paginaAtual: number; quantidadeDePaginas: number };
    items: T[];
  }>,
  pageSize: number,
) {
  let page = 0;
  while (true) {
    const res = await fn(page, pageSize);
    yield res.items;

    if (res.paginacao.paginaAtual >= res.paginacao.quantidadeDePaginas - 1)
      break;
    page += 1;
  }
}

export async function reconcileRetroactivePayments(params: Params) {
  const pageSize = Math.min(Math.max(params.pageSize ?? 100, 20), 1000);

  let cobChecked = 0;
  let cobPaid = 0;
  let cobStatusUpdated = 0;

  let cobrChecked = 0;
  let cobrUpserted = 0;

  if (params.reconcileInitialCob ?? true) {
    // ✅ 1) Lista COBs do período (paginado)
    for await (const items of paginate(async (page, size) => {
      const data = await pixAutoClient.cob.list({
        inicio: params.inicioISO,
        fim: params.fimISO,
        "paginacao.paginaAtual": page,
        "paginacao.itensPorPagina": size,
      });

      return {
        paginacao: data.parametros.paginacao,
        items: data.cobs ?? [],
      };
    }, pageSize)) {
      cobChecked += items.length;

      // ✅ 2) Atualiza somente o que existe no seu banco
      //    (evita scan gigante no Prisma)
      const txids = items
        .map((c) => String(c.txid ?? "").trim())
        .filter(Boolean);

      const attempts = await prisma.initialPaymentAttempt.findMany({
        where: { txid: { in: txids }, paidAt: null },
        select: { enrollmentId: true, txid: true, status: true },
      });

      const byTxid = new Map(
        items.map((c) => [String(c.txid).trim(), c] as const),
      );

      for (const a of attempts) {
        const cob = byTxid.get(a.txid);
        if (!cob) continue;

        const next =
          mapEfiCobToPaymentStatus(String(cob.status ?? "")) ?? "ACTIVE";

        if (next === "PAID") {
          await prisma.$transaction(async (tx) => {
            const current = await tx.initialPaymentAttempt.findUnique({
              where: { enrollmentId: a.enrollmentId },
              select: { paidAt: true },
            });
            if (current?.paidAt) return;

            await tx.initialPaymentAttempt.update({
              where: { enrollmentId: a.enrollmentId },
              data: {
                status: "PAID",
                paidAt: new Date(),
                payload: asInputJson({
                  cob,
                  _reconcile: {
                    at: new Date().toISOString(),
                    source: "GET /v2/cob (list)",
                  },
                }),
              },
            });

            await tx.enrollment.update({
              where: { id: a.enrollmentId },
              data: { status: "CONFIRMED", confirmedAt: new Date() },
            });
          });
          cobPaid += 1;
        } else if (next !== a.status) {
          await prisma.initialPaymentAttempt.update({
            where: { enrollmentId: a.enrollmentId },
            data: {
              status: next,
              payload: asInputJson({
                cob,
                _reconcile: {
                  at: new Date().toISOString(),
                  source: "GET /v2/cob (list)",
                },
              }),
            },
          });
          cobStatusUpdated += 1;
        }
      }
    }
  }

  if (params.reconcileRecurringCobr ?? true) {
    // ✅ Lista COBRs do período (paginado)
    for await (const items of paginate(async (page, size) => {
      const data = await pixAutoClient.cobr.list({
        inicio: params.inicioISO,
        fim: params.fimISO,
        "paginacao.paginaAtual": page,
        "paginacao.itensPorPagina": size,
        ...(params.idRec ? { idRec: params.idRec } : {}),
      });

      return {
        paginacao: data.parametros.paginacao,
        items: data.cobsr ?? [],
      };
    }, pageSize)) {
      cobrChecked += items.length;

      // ✅ UPSERT local por txid (se existir no payload)
      // Observação: sua model PixAutoCobr tem txid? @unique, então dá pra usar upsert via txid
      for (const cobr of items) {
        const txid = String(cobr.txid ?? "").trim();
        if (!txid) continue;

        await prisma.pixAutoCobr.upsert({
          where: { txid },
          update: {
            status: String(cobr.status ?? "CRIADA"),
            politicaRetentativa:
              typeof cobr.politicaRetentativa === "string"
                ? cobr.politicaRetentativa
                : null,
            payload: asInputJson(cobr),
          },
          create: {
            // ⚠️ aqui você precisa do recurrenceId interno.
            // Se você armazenar mapeamento idRec->PixAutoRecurrence.id, dá para resolver.
            // Se não tiver, crie um job em 2 passos: (1) rec.list para mapear, (2) cobr.list.
            recurrenceId: "__TODO_RESOLVE__",
            txid,
            status: String(cobr.status ?? "CRIADA"),
            dataVencimento: new Date(
              String(cobr.calendario?.dataDeVencimento ?? params.inicioISO),
            ),
            valorOriginal: String(cobr.valor?.original ?? "0.00"),
            infoAdicional:
              typeof cobr.infoAdicional === "string"
                ? cobr.infoAdicional
                : null,
            ajusteDiaUtil: Boolean(cobr.ajusteDiaUtil),
            politicaRetentativa:
              typeof cobr.politicaRetentativa === "string"
                ? cobr.politicaRetentativa
                : null,
            idempotencyKey: txid,
            payload: asInputJson(cobr),
          },
        });

        cobrUpserted += 1;
      }
    }
  }

  return {
    inicioISO: params.inicioISO,
    fimISO: params.fimISO,
    cob: {
      checked: cobChecked,
      paid: cobPaid,
      statusUpdated: cobStatusUpdated,
    },
    cobr: { checked: cobrChecked, upserted: cobrUpserted },
  };
}
