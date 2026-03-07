import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

async function prepareData() {
  logger.info("Verificando candidatos para migração...");

  // Busca recorrências que não são JORNADA_2 e não estão CANCELADAS
  const candidates = await prisma.pixAutoRecurrence.findMany({
    where: {
      AND: [
        { jornada: { not: "JORNADA_2" } },
        { status: { notIn: ["CANCELADA", "CANCELLED"] } },
        { idRec: { not: null } },
      ],
    },
  });

  logger.info(`Encontrados ${candidates.length} candidatos.`);

  for (const rec of candidates) {
    // Força o status correto para aparecer na nossa UI de migração
    await prisma.pixAutoRecurrence.update({
      where: { id: rec.id },
      data: { jornada: "AGUARDANDO_DEFINICAO" },
    });
  }

  logger.info(
    "Dados preparados com sucesso. Verifique a tela /admin/migration.",
  );
}

prepareData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
