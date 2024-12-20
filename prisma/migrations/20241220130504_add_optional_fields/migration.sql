-- DropForeignKey
ALTER TABLE "Charge" DROP CONSTRAINT "Charge_carnetId_fkey";

-- AlterTable
ALTER TABLE "Carnet" ALTER COLUMN "updatedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Charge" ALTER COLUMN "carnetId" SET DATA TYPE TEXT,
ALTER COLUMN "parcelLink" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_carnetId_fkey" FOREIGN KEY ("carnetId") REFERENCES "Carnet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
