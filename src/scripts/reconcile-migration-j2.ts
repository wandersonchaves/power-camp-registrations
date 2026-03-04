import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { syncMigrationStatus } from "@/use-cases/migration/sync-migration-status";

async function runReconcile() {
  logger.info("Starting J2 Migration Reconcile...");

  const pendingMigrations = await prisma.pixAutoMigration.findMany({
    where: {
      status: { in: ["QR_GENERATED", "SENT"] },
    },
    orderBy: { lastCheckedAt: "asc" },
    take: 20,
  });

  logger.info(`Found ${pendingMigrations.length} pending migrations.`);

  for (const migration of pendingMigrations) {
    logger.info(`Checking migration ${migration.id}...`);
    try {
      await syncMigrationStatus(migration.id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(`Error checking migration ${migration.id}`, {
        error: message,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  logger.info("Reconcile finished.");
}

runReconcile()
  .catch((e) => {
    logger.error("Critical Reconcile Failure", { error: String(e) });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
