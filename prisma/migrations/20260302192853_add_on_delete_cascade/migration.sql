-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_participantId_fkey";

-- DropForeignKey
ALTER TABLE "InitialPaymentAttempt" DROP CONSTRAINT "InitialPaymentAttempt_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "PixAutoCobr" DROP CONSTRAINT "PixAutoCobr_recurrenceId_fkey";

-- DropForeignKey
ALTER TABLE "PixAutoRecurrence" DROP CONSTRAINT "PixAutoRecurrence_participantId_fkey";

-- DropForeignKey
ALTER TABLE "PixAutoSolicRec" DROP CONSTRAINT "PixAutoSolicRec_recurrenceId_fkey";

-- CreateIndex
CREATE INDEX "Enrollment_participantId_idx" ON "Enrollment"("participantId");

-- CreateIndex
CREATE INDEX "Participant_userId_idx" ON "Participant"("userId");

-- AddForeignKey
ALTER TABLE "PixAutoRecurrence" ADD CONSTRAINT "PixAutoRecurrence_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixAutoSolicRec" ADD CONSTRAINT "PixAutoSolicRec_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "PixAutoRecurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixAutoCobr" ADD CONSTRAINT "PixAutoCobr_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "PixAutoRecurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialPaymentAttempt" ADD CONSTRAINT "InitialPaymentAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
