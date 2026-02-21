-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_teamId_fkey";

-- DropIndex
DROP INDEX "Enrollment_eventId_teamId_status_idx";

-- AlterTable
ALTER TABLE "Enrollment" ALTER COLUMN "teamId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Enrollment_eventId_status_idx" ON "Enrollment"("eventId", "status");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
