import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function syncMigrationStatus(migrationId: string) {
  const migration = await prisma.pixAutoMigration.findUnique({
    where: { id: migrationId },
    include: { recurrence: true },
  });

  if (!migration || !migration.recurrence.idRec) return null;

  try {
    const efiRec = await pixAutoClient.rec.get(migration.recurrence.idRec);
    const efiStatus = efiRec.status;

    let finalStatus = migration.status;

    await prisma.$transaction(async (tx) => {
      if (efiStatus === "ATIVA") {
        await tx.pixAutoMigration.update({
          where: { id: migration.id },
          data: {
            status: "CONSENT_ACCEPTED",
            acceptedAt: new Date(),
            lastCheckedAt: new Date(),
          },
        });

        await tx.pixAutoRecurrence.update({
          where: { id: migration.recurrenceId },
          data: {
            status: "ACTIVE",
            jornada: "JORNADA_2",
          },
        });
        finalStatus = "CONSENT_ACCEPTED";
        logger.info(`Migration successful: ${migration.id}`, { efiStatus });
      } else if (efiStatus === "REJEITADA") {
        await tx.pixAutoMigration.update({
          where: { id: migration.id },
          data: { status: "CONSENT_REJECTED", lastCheckedAt: new Date() },
        });
        finalStatus = "CONSENT_REJECTED";
      } else {
        await tx.pixAutoMigration.update({
          where: { id: migration.id },
          data: { lastCheckedAt: new Date() },
        });
      }

      await tx.migrationAuditLog.create({
        data: {
          migrationId: migration.id,
          action: "SYNC_CHECK",
          payload: { efiStatus, checkedAt: new Date() },
        },
      });
    });

    return { status: finalStatus, efiStatus };
  } catch (error) {
    logger.error(`Failed to sync migration ${migrationId}`, { error });

    await prisma.pixAutoMigration.update({
      where: { id: migration.id },
      data: {
        lastError: { message: (error as Error).message, timestamp: new Date() },
        lastCheckedAt: new Date(),
      },
    });
    throw error;
  }
}
