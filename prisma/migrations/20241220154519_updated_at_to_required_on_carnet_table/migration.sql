/*
  Warnings:

  - Made the column `updatedAt` on table `Carnet` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Carnet" ALTER COLUMN "updatedAt" SET NOT NULL;
