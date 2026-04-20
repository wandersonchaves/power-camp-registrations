import { TeamCode } from "@prisma/client";

import { createNextCobrForRecurrenceUseCase } from "./create-next-cobr-for-recurrence.use-case";

import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type Input = {
  eventId: string;
  teamCode?: TeamCode;
  targetCompetencia?: string; // YYYY-MM
  dueDateDay?: number; // default 10
};

/**
 * Executa a geração de cobranças para uma equipe específica ou todas as equipes.
 */
export async function runTeamRecurrenceBatchUseCase(input: Input) {
  const { eventId, teamCode, dueDateDay = 10 } = input;

  const now = new Date();
  // Se não informada, a competência alvo é o mês ATUAL (conforme nova regra)
  let competencia = input.targetCompetencia;
  if (!competencia) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    competencia = `${year}-${String(month).padStart(2, "0")}`;
  }

  log("info", "[BATCH] Starting team recurrence batch", {
    teamCode,
    competencia,
  });

  // 1. Busca recorrências ativas
  // Filtramos por equipe via Participant -> Enrollment
  const recurrences = await prisma.pixAutoRecurrence.findMany({
    where: {
      eventId,
      status: "APROVADA", // EFI status para ativo
      participant: {
        enrollments: {
          some: {
            eventId,
            ...(teamCode ? { team: { code: teamCode } } : {}),
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        },
      },
      // Evita duplicados para a mesma competência
      charges: {
        none: { competencia },
      },
    },
    include: {
      event: true,
      participant: {
        include: {
          enrollments: {
            where: { eventId },
            include: { team: true },
          },
        },
      },
    },
  });

  log("info", `[BATCH] Found ${recurrences.length} recurrences to process`, {
    teamCode,
    competencia,
  });

  const results = {
    total: recurrences.length,
    success: 0,
    failed: 0,
    details: [] as {
      recurrenceId: string;
      status: "success" | "failed";
      error?: string;
    }[],
  };

  // Se hoje é dia 20, o vencimento mínimo permitido pela Efí é dia 22 (D+2)
  const currentDay = now.getUTCDate();
  const safeDueDateDay = Math.max(dueDateDay, currentDay + 2);

  for (const rec of recurrences) {
    try {
      // Formata o dia com zero à esquerda para compor a data YYYY-MM-DD
      const dayStr = String(safeDueDateDay).padStart(2, "0");
      const dueDate = `${competencia}-${dayStr}`;

      await createNextCobrForRecurrenceUseCase({
        eventId: rec.eventId,
        recurrenceId: rec.id,
        dueDate,
        amount: rec.valorRec,
        recebedor: {
          conta: process.env.EFI_RECEBEDOR_CONTA || "000000",
          tipoConta: "CORRENTE",
        },
        infoAdicional: `Parcela ${competencia} - ${rec.event.name}`,
      });

      results.success++;
      results.details.push({ recurrenceId: rec.id, status: "success" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log("error", "[BATCH] Failed to create cobr", {
        recurrenceId: rec.id,
        idRec: rec.idRec,
        error: errorMessage,
      });
      results.failed++;
      results.details.push({
        recurrenceId: rec.id,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  log("info", "[BATCH] Finished team recurrence batch", {
    success: results.success,
    failed: results.failed,
    competencia,
  });

  return results;
}
