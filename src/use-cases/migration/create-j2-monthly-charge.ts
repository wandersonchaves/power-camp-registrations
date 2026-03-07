import { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { generateTxid } from "@/infra/efi/txid";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

function calculateDueDate(competencia: string) {
  // Ex: "2024-05" -> retorna "2024-05-10" (dia 10 de cada mês)
  return `${competencia}-10`;
}

export async function createJ2MonthlyCharge(
  recurrenceId: string,
  competencia: string,
) {
  const recurrence = await prisma.pixAutoRecurrence.findUnique({
    where: { id: recurrenceId },
    include: { participant: true },
  });

  if (!recurrence || recurrence.jornada !== "JORNADA_2") {
    throw new Error("Recorrência não está na Jornada 2 ou não existe.");
  }

  const existing = await prisma.pixAutoCobr.findUnique({
    where: { recurrenceId_competencia: { recurrenceId, competencia } },
  });

  if (existing) return existing;

  const txid = generateTxid();

  try {
    const dataVencimento = calculateDueDate(competencia);

    // Pegamos o tipo esperado pelo SDK para o campo 'devedor' dinamicamente
    type PutParams = Parameters<typeof pixAutoClient.cobr.put>;
    type DevedorType = PutParams[1]["devedor"];

    const efiResponse = await pixAutoClient.cobr.put(txid, {
      idRec: recurrence.idRec!,
      calendario: { dataDeVencimento: dataVencimento },
      valor: { original: recurrence.valorRec },
      devedor: { cpf: recurrence.participant.cpf } as unknown as DevedorType,
      infoAdicional: "Competência " + competencia,
    });

    return await prisma.pixAutoCobr.create({
      data: {
        recurrenceId: recurrence.id,
        txid: txid,
        status: "ATIVA",
        competencia: competencia,
        valorOriginal: recurrence.valorRec,
        dataVencimento: new Date(dataVencimento),
        idempotencyKey: `cobr_${recurrence.id}_${competencia}`,
        payload: efiResponse as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Failed to create J2 charge", {
      recurrenceId,
      competencia,
      error: message,
    });
    throw error;
  }
}
