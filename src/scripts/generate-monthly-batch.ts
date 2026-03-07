import { addMonths, format } from "date-fns";

import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createJ2MonthlyCharge } from "@/use-cases/migration/create-j2-monthly-charge";

async function runMonthlyBatch() {
  // Define a competência (Ex: "2024-05") para o próximo mês
  const nextMonth = addMonths(new Date(), 1);
  const competencia = format(nextMonth, "yyyy-MM");

  logger.info(`Iniciando geração de cobranças para: ${competencia}`);

  const activeRecurrences = await prisma.pixAutoRecurrence.findMany({
    where: {
      jornada: "JORNADA_2",
      status: "ACTIVE",
    },
  });

  logger.info(`Processando ${activeRecurrences.length} clientes ativos.`);

  for (const rec of activeRecurrences) {
    try {
      logger.info(`Gerando cobrança para cliente ${rec.participantId}...`);
      await createJ2MonthlyCharge(rec.id, competencia);
      logger.info(`✅ Sucesso para recorrência: ${rec.id}`);
    } catch (error) {
      logger.error(`❌ Falha na recorrência ${rec.id}:`, { error });
    }
  }

  logger.info("Batch de cobranças finalizado.");
}

runMonthlyBatch()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
