-- AlterTable
ALTER TABLE "InitialPaymentAttempt" ADD COLUMN     "endToEndId" TEXT;

-- AlterTable
ALTER TABLE "PixAutoCobr" ADD COLUMN     "createdAtEfi" TIMESTAMP(3),
ADD COLUMN     "endToEndId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InitialPaymentAttempt_txid_idx" ON "InitialPaymentAttempt"("txid");

-- CreateIndex
CREATE INDEX "InitialPaymentAttempt_endToEndId_idx" ON "InitialPaymentAttempt"("endToEndId");

-- CreateIndex
CREATE INDEX "PixAutoCobr_paidAt_idx" ON "PixAutoCobr"("paidAt");
