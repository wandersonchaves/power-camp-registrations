-- CreateEnum
CREATE TYPE "TeamPaymentSource" AS ENUM ('WEBHOOK', 'RECONCILIATION', 'IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "TeamPaymentConfirmation" AS ENUM ('CONFIRMED', 'UNCONFIRMED');

-- CreateEnum
CREATE TYPE "TeamPaymentStatus" AS ENUM ('ALLOCATED', 'UNATTRIBUTED', 'IGNORED', 'PARTIAL');

-- CreateTable
CREATE TABLE "TeamInstallment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "dueMonth" DATE NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPayment" (
    "id" TEXT NOT NULL,
    "endToEndId" TEXT NOT NULL,
    "txid" TEXT,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "payerName" TEXT,
    "payerDocument" TEXT,
    "teamId" TEXT,
    "source" "TeamPaymentSource" NOT NULL,
    "confirmation" "TeamPaymentConfirmation" NOT NULL DEFAULT 'CONFIRMED',
    "status" "TeamPaymentStatus" NOT NULL,
    "attributionReason" TEXT,
    "createdByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPayerAlias" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPayerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPaymentAuditLog" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "teamId" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamInstallment_teamId_dueMonth_key" ON "TeamInstallment"("teamId", "dueMonth");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPayment_endToEndId_key" ON "TeamPayment"("endToEndId");

-- CreateIndex
CREATE INDEX "TeamPayment_teamId_paidAt_idx" ON "TeamPayment"("teamId", "paidAt");

-- CreateIndex
CREATE INDEX "TeamPayment_status_idx" ON "TeamPayment"("status");

-- CreateIndex
CREATE INDEX "TeamPayment_txid_idx" ON "TeamPayment"("txid");

-- CreateIndex
CREATE INDEX "TeamPaymentAllocation_paymentId_idx" ON "TeamPaymentAllocation"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPaymentAllocation_installmentId_key" ON "TeamPaymentAllocation"("installmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPayerAlias_normalizedName_key" ON "TeamPayerAlias"("normalizedName");

-- CreateIndex
CREATE INDEX "TeamPayerAlias_teamId_idx" ON "TeamPayerAlias"("teamId");

-- CreateIndex
CREATE INDEX "TeamPaymentAuditLog_paymentId_idx" ON "TeamPaymentAuditLog"("paymentId");

-- CreateIndex
CREATE INDEX "TeamPaymentAuditLog_createdAt_idx" ON "TeamPaymentAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "TeamInstallment" ADD CONSTRAINT "TeamInstallment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPayment" ADD CONSTRAINT "TeamPayment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPaymentAllocation" ADD CONSTRAINT "TeamPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "TeamPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPaymentAllocation" ADD CONSTRAINT "TeamPaymentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "TeamInstallment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPayerAlias" ADD CONSTRAINT "TeamPayerAlias_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

