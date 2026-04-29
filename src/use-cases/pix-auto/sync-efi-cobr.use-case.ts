import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

interface EfiCobrItem {
  txid?: string;
  idRec?: string;
  status?: string;
  valor?: { original?: string };
  infoAdicional?: string;
  calendario?: { dataDeVencimento?: string };
  tentativas?: Array<{
    status?: string;
    dataLiquidacao?: string;
    endToEndId?: string;
  }>;
}

/**
 * Sincroniza uma lista de cobranças (cobsr) retornadas pela API do EFI.
 */
export async function syncEfiCobrList(cobrs: unknown[]) {
  const stats = { updated: 0, created: 0, errors: 0 };

  for (const item of cobrs) {
    try {
      const efiCobr = item as EfiCobrItem;
      const {
        txid,
        idRec,
        status: efiStatus,
        valor,
        infoAdicional,
        calendario,
        tentativas,
      } = efiCobr;

      if (!txid || !idRec) continue;

      const recurrence = await prisma.pixAutoRecurrence.findUnique({
        where: { idRec },
      });

      if (!recurrence) continue;

      const lastAttempt = tentativas?.[tentativas.length - 1];
      const isScheduled = lastAttempt?.status === "AGENDADA";
      const isPaid =
        efiStatus === "CONCLUIDA" || lastAttempt?.status === "PAGO";

      let dbStatus = "ACTIVE";
      if (isPaid) dbStatus = "CONCLUIDA";
      else if (isScheduled) dbStatus = "AGENDADA";
      else if (
        efiStatus === "REJEITADA" ||
        efiStatus === "CANCELADA" ||
        efiStatus === "EXPIRADA"
      )
        dbStatus = efiStatus;

      const paidAt =
        isPaid || isScheduled
          ? new Date(lastAttempt?.dataLiquidacao || new Date())
          : null;

      await prisma.pixAutoCobr.upsert({
        where: { txid },
        update: {
          status: dbStatus,
          paidAt: paidAt,
          endToEndId: lastAttempt?.endToEndId || null,
          payload: asInputJson(efiCobr),
          updatedAt: new Date(),
        },
        create: {
          txid,
          recurrenceId: recurrence.id,
          status: dbStatus,
          valorOriginal: valor?.original || "0.00",
          dataVencimento: new Date(calendario?.dataDeVencimento || new Date()),
          infoAdicional: infoAdicional || "",
          idempotencyKey: `auto-sync-${txid}`,
          paidAt: paidAt,
          endToEndId: lastAttempt?.endToEndId || null,
          payload: asInputJson(efiCobr),
          competencia: infoAdicional?.match(/\d{4}-\d{2}/)?.[0] || null,
        },
      });

      stats.updated++;
    } catch (error) {
      logger.error(`[SYNC-COBR] Erro txid=${(item as EfiCobrItem).txid}`, {
        error,
      });
      stats.errors++;
    }
  }
  return stats;
}
