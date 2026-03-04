/*
  Warnings:

  - A unique constraint covering the columns `[recurrenceId,competencia]` on the table `PixAutoCobr` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[firstCobTxid]` on the table `PixAutoRecurrence` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PixAutoCobr" ADD COLUMN     "competencia" TEXT;

-- AlterTable
ALTER TABLE "PixAutoRecurrence" ADD COLUMN     "firstCobTxid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoCobr_recurrenceId_competencia_key" ON "PixAutoCobr"("recurrenceId", "competencia");

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoRecurrence_firstCobTxid_key" ON "PixAutoRecurrence"("firstCobTxid");
