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
  const { eventId, teamCode } = input;

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

  for (const rec of recurrences) {
    try {
      // Regra de segurança: O vencimento não pode ser anterior à dataInicial da recorrência
      // nem anterior a D+2 (regra da Efí para cobranças manuais de Pix Automático)
      const recurrenceStart = new Date(rec.dataInicial);
      const minAllowedDate = new Date(now.getTime());
      minAllowedDate.setUTCDate(now.getUTCDate() + 2);

      let finalDueDate: Date;
      if (recurrenceStart > minAllowedDate) {
        finalDueDate = recurrenceStart;
      } else {
        finalDueDate = minAllowedDate;
        // Se a dataInicial for, por exemplo, dia 20 e hoje é 20, o minAllowedDate (22) é usado.
      }

      // Garante que o vencimento caia no dia solicitado (ou no dia seguro calculado)
      // Se o admin pediu dia 10, mas hoje é 20, usamos o dia seguro.
      const dayToUse = finalDueDate.getUTCDate();
      const monthToUse = finalDueDate.getUTCMonth() + 1;
      const yearToUse = finalDueDate.getUTCFullYear();

      const dueDate = `${yearToUse}-${String(monthToUse).padStart(2, "0")}-${String(dayToUse).padStart(2, "0")}`;

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
