import { TeamCode } from "@prisma/client";
import { addDays } from "date-fns";

import { createNextCobrForRecurrenceUseCase } from "./create-next-cobr-for-recurrence.use-case";
import { createSolicRecUseCase } from "./create-solicrec.use-case";

import efiConfig from "@/config/efiConfig";
import { pixAutoClient } from "@/infra/efi/pix-auto.client";
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
  let competencia = input.targetCompetencia;
  if (!competencia) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    competencia = `${year}-${String(month).padStart(2, "0")}`;
  }

  console.log(
    `[BATCH] Starting team recurrence batch for ${competencia} - Team: ${teamCode || "ALL"}`,
  );

  const recurrences = await prisma.pixAutoRecurrence.findMany({
    where: {
      eventId,
      status: { in: ["APROVADA", "CRIADA", "ATIVA"] },
      participant: {
        enrollments: {
          some: {
            eventId,
            ...(teamCode ? { team: { code: teamCode } } : {}),
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        },
      },
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
        `[BATCH] Synchronizing status for ${rec.idRec} (${rec.participant.fullName})...`,
      );

      // Sincroniza status com a Efí antes de agir
      const efiRec = await pixAutoClient.rec.get(rec.idRec!);
      const currentStatus = efiRec.status;

      if (currentStatus !== rec.status) {
        console.log(
          `[BATCH] Updating local status from ${rec.status} to ${currentStatus}`,
        );
        await prisma.pixAutoRecurrence.update({
          where: { id: rec.id },
          data: { status: currentStatus },
        });
        rec.status = currentStatus; // Atualiza a referência local para o loop
      }

      // 1. Se o status for CRIADA, precisamos criar uma solicitação (solicrec)
      if (rec.status === "CRIADA") {
        console.log(
          `[BATCH] Recurrence ${rec.idRec} is still CRIADA. Creating solicrec...`,
        );
        await createSolicRecUseCase({
          recurrenceId: rec.id,
          dataExpiracaoSolicitacaoISO: addDays(now, 7).toISOString(),
          destinatario: {
            agencia: efiConfig.recebedor.agencia,
            conta: efiConfig.recebedor.conta,
            cpf: rec.participant.cpf, // FIXME: Deveria ser o CPF/CNPJ do recebedor, mas mantendo conforme original
            ispbParticipante: efiConfig.recebedor.ispb,
          },
        });
        console.log(
          `[BATCH] ✅ Solicrec created for ${rec.idRec}. User must approve in bank.`,
        );
        results.success++;
        continue; // Para este participante, paramos aqui até ele aprovar
      }

      // 2. Se o status for APROVADA ou ATIVA, gera a cobrança do mês
      if (rec.status === "APROVADA" || rec.status === "ATIVA") {
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

        console.log(`[BATCH] ✅ Success generating charge for ${rec.idRec}`);
        results.success++;
        results.details.push({ recurrenceId: rec.id, status: "success" });
      } else {
        console.log(
          `[BATCH] ℹ️ Recurrence ${rec.idRec} in status ${rec.status}. Skipping charge generation.`,
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[BATCH] ❌ Failed for ${rec.idRec}: ${errorMessage}`);
      results.failed++;
      results.details.push({
        recurrenceId: rec.id,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  console.log(
    `[BATCH] Finished team recurrence batch. Success: ${results.success}, Failed: ${results.failed}`,
  );

  return results;
}
