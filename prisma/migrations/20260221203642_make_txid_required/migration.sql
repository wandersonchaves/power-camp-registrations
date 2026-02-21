/*
  Warnings:

  - Made the column `txid` on table `InitialPaymentAttempt` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "InitialPaymentAttempt_idempotencyKey_key";

-- AlterTable
ALTER TABLE "InitialPaymentAttempt" ALTER COLUMN "txid" SET NOT NULL;
