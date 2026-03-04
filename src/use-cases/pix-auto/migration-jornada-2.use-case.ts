// src/use-cases/pix-auto/migration-jornada-2.use-case.ts
import { Prisma } from "@prisma/client";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Migração para quem já pagou o COB inicial mas a recorrência não ativou automaticamente.
 * Gera o QR Code de ativação manual (Jornada 2).
 */
export async function migrationJornada2UseCase() {
  const stuckRecurrences = await prisma.pixAutoRecurrence.findMany({
    where: {
      status: "CRIADA",
      jornada: { contains: "AGUARDANDO" },
    },
    select: { id: true, idRec: true, contrato: true, payload: true },
  });

  log(
    "info",
    `[MIGRATION J2] Found ${stuckRecurrences.length} stuck recurrences`,
  );

  const results = { updated: 0, failed: 0 };

  for (const rec of stuckRecurrences) {
    if (!rec.idRec) continue;

    try {
      // GET /v2/rec/:idRec sem txid gera QR Jornada 2
      const full = (await pixAutoClient.rec.get(
        rec.idRec,
      )) as Prisma.JsonObject;

      if ((full.dadosQR as Prisma.JsonObject | undefined)?.pixCopiaECola) {
        const currentPayload = (rec.payload as Prisma.JsonObject) || {};

        await prisma.pixAutoRecurrence.update({
          where: { id: rec.id },
          data: {
            pixCopiaECola: (full.dadosQR as Prisma.JsonObject)
              .pixCopiaECola as string,
            jornada: "JORNADA_2", // Agora é J2 pois o QR é manual
            payload: {
              ...currentPayload,
              migrationAt: new Date().toISOString(),
              migrationNote: "Migrated from stuck J3 to J2 activation",
              recGetJ2: full,
            } as Prisma.InputJsonValue,
          },
        });
        results.updated++;
      }
    } catch (err) {
      log("error", "[MIGRATION J2] Failed to fetch J2 QR", {
        idRec: rec.idRec,
        error: String(err),
      });
      results.failed++;
    }
  }

  return results;
}
