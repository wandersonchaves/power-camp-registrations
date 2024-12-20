/*
  Warnings:

  - Made the column `updatedAt` on table `Charge` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Carnet" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Charge" ALTER COLUMN "parcelLink" SET DEFAULT '',
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
