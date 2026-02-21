/*
  Warnings:

  - Made the column `payload` on table `InitialPaymentAttempt` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "InitialPaymentAttempt_txid_key";

-- AlterTable
ALTER TABLE "InitialPaymentAttempt" ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "payload" SET NOT NULL,
ALTER COLUMN "payload" SET DEFAULT '{}';
