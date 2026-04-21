import { TeamCode } from "@prisma/client";
import { addDays } from "date-fns";

import { createNextCobrForRecurrenceUseCase } from "./create-next-cobr-for-recurrence.use-case";
import { createSolicRecUseCase } from "./create-solicrec.use-case";

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
  console.log(
    `[BATCH] Starting team recurrence batch for ${competencia} - Team: ${teamCode || "ALL"}`,
  );

  // 1. Busca recorrências ativas
  // Filtramos por equipe via Participant -> Enrollment
  const recurrences = await prisma.pixAutoRecurrence.findMany({
    where: {
      eventId,
      status: { in: ["APROVADA", "CRIADA", "ATIVA"] }, // Aceita múltiplos status válidos da Efí
      participant: {
        enrollments: {
          some: {
            eventId,
            ...(teamCode ? { team: { code: teamCode } } : {}),
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        },
      },
      // Permitir se não houver cobrança ativa ou paga
      charges: {
        none: {
          competencia,
          status: { in: ["ATIVA", "CONCLUIDA", "PAGO"] },
        },
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
  console.log(`[BATCH] Found ${recurrences.length} recurrences to process`);

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
      console.log(
        `[BATCH] Processing recurrence ${rec.idRec} for ${rec.participant.fullName}`,
      );

      // 1. Se o status for CRIADA, precisamos criar uma solicitação (solicrec) primeiro para o banco aprovar
      if (rec.status === "CRIADA") {
        console.log(
          `[BATCH] Recurrence ${rec.idRec} is CRIADA. Creating solicrec first...`,
        );
        // Usamos dados de exemplo funcional do pagador
        await createSolicRecUseCase({
          recurrenceId: rec.id,
          dataExpiracaoSolicitacaoISO: addDays(now, 7).toISOString(),
          destinatario: {
            agencia: "1823",
            conta: "54940917",
            cpf: rec.participant.cpf,
            ispbParticipante: "18236120",
          },
        });
        console.log(`[BATCH] Solicrec created for ${rec.idRec}.`);
      }

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
      }

      const dayToUse = finalDueDate.getUTCDate();
      const monthToUse = finalDueDate.getUTCMonth() + 1;
      const yearToUse = finalDueDate.getUTCFullYear();

      const dueDate = `${yearToUse}-${String(monthToUse).padStart(2, "0")}-${String(dayToUse).padStart(2, "0")}`;

      await createNextCobrForRecurrenceUseCase({
        eventId: rec.eventId,
        recurrenceId: rec.id,
        dueDate,
        amount: rec.valorRec,
        infoAdicional: `Parcela ${competencia} - ${rec.event.name}`,
      });

      console.log(`[BATCH] ✅ Success for ${rec.idRec}`);
      results.success++;
      results.details.push({ recurrenceId: rec.id, status: "success" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[BATCH] ❌ Failed for ${rec.idRec}: ${errorMessage}`);
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
  console.log(
    `[BATCH] Finished team recurrence batch. Success: ${results.success}, Failed: ${results.failed}`,
  );

  return results;
}
