// src/use-cases/pix-auto/scheduler-cobr.use-case.ts
import { createNextCobrForRecurrenceUseCase } from "./create-next-cobr-for-recurrence.use-case";

import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Job diário para gerar cobranças do mês seguinte para recorrências ativas.
 */
export async function schedulerCobrUseCase() {
  const now = new Date();
  // Alvo: Próximo mês
  const targetYear =
    now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const targetMonth = ((now.getUTCMonth() + 1) % 12) + 1;
  const competencia = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;

  log("info", "[SCHEDULER] Starting cobr generation", { competencia });

  // 1. Busca recorrências ativas que NÃO possuem cobrança para esta competência
  const recurrences = await prisma.pixAutoRecurrence.findMany({
    where: {
      status: "APROVADA", // Efí chama de APROVADA quando ativa
      charges: {
        none: { competencia },
      },
    },
    include: {
      event: true,
      participant: true,
    },
  });

  log(
    "info",
    `[SCHEDULER] Found ${recurrences.length} recurrences to process`,
    { competencia },
  );

  const results = { success: 0, failed: 0 };

  for (const rec of recurrences) {
    try {
      // Determina a data de vencimento (Ex: dia 10 do mês alvo)
      const day = 10;
      const dueDate = `${competencia}-${String(day).padStart(2, "0")}`;

      await createNextCobrForRecurrenceUseCase({
        eventId: rec.eventId,
        recurrenceId: rec.id,
        dueDate,
        amount: rec.valorRec,
        infoAdicional: `Parcela ${competencia} - ${rec.event.name}`,
      });

      results.success++;
    } catch (err) {
      log("error", "[SCHEDULER] Failed to create cobr", {
        recurrenceId: rec.id,
        idRec: rec.idRec,
        error: String(err),
      });
      results.failed++;
    }
  }

  log("info", "[SCHEDULER] Finished cobr generation", {
    ...results,
    competencia,
  });
  return results;
}
