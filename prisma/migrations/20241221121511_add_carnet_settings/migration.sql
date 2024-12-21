-- CreateTable
CREATE TABLE "CarnetSettings" (
    "id" SERIAL NOT NULL,
    "travelServiceName" TEXT NOT NULL,
    "installmentValue" INTEGER NOT NULL,
    "installments" INTEGER NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "defaultMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarnetSettings_pkey" PRIMARY KEY ("id")
);
