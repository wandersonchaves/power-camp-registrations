-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING_CONSENT', 'QR_GENERATED', 'SENT', 'CONSENT_ACCEPTED', 'CONSENT_REJECTED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "PixAutoMigration" (
    "id" TEXT NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "recurrenceId" TEXT NOT NULL,
    "consentQrCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" JSONB,
    "metadata" JSONB,
    "generatedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixAutoMigration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationAuditLog" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoMigration_recurrenceId_key" ON "PixAutoMigration"("recurrenceId");

-- CreateIndex
CREATE INDEX "PixAutoMigration_status_lastCheckedAt_idx" ON "PixAutoMigration"("status", "lastCheckedAt");

-- AddForeignKey
ALTER TABLE "PixAutoMigration" ADD CONSTRAINT "PixAutoMigration_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "PixAutoRecurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationAuditLog" ADD CONSTRAINT "MigrationAuditLog_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "PixAutoMigration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
