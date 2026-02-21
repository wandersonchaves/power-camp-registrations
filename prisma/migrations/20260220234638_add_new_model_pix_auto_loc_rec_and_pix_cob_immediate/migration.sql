-- CreateTable
CREATE TABLE "PixAutoLocRec" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT,
    "locId" INTEGER NOT NULL,
    "locationUrl" TEXT NOT NULL,
    "criacao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixAutoLocRec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixCobImmediate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT,
    "txid" TEXT,
    "status" TEXT NOT NULL,
    "valorOriginal" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixCobImmediate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoLocRec_locId_key" ON "PixAutoLocRec"("locId");

-- CreateIndex
CREATE INDEX "PixAutoLocRec_eventId_idx" ON "PixAutoLocRec"("eventId");

-- CreateIndex
CREATE INDEX "PixAutoLocRec_participantId_idx" ON "PixAutoLocRec"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "PixCobImmediate_txid_key" ON "PixCobImmediate"("txid");

-- CreateIndex
CREATE UNIQUE INDEX "PixCobImmediate_idempotencyKey_key" ON "PixCobImmediate"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PixCobImmediate_eventId_idx" ON "PixCobImmediate"("eventId");

-- CreateIndex
CREATE INDEX "PixCobImmediate_participantId_idx" ON "PixCobImmediate"("participantId");

-- CreateIndex
CREATE INDEX "PixCobImmediate_status_idx" ON "PixCobImmediate"("status");

-- AddForeignKey
ALTER TABLE "PixAutoLocRec" ADD CONSTRAINT "PixAutoLocRec_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixAutoLocRec" ADD CONSTRAINT "PixAutoLocRec_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixCobImmediate" ADD CONSTRAINT "PixCobImmediate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixCobImmediate" ADD CONSTRAINT "PixCobImmediate_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
