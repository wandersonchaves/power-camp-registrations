-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixAutoRecurrence" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "idRec" TEXT,
    "status" TEXT NOT NULL,
    "valorRec" TEXT NOT NULL,
    "periodicidade" TEXT NOT NULL,
    "dataInicial" TIMESTAMP(3) NOT NULL,
    "dataFinal" TIMESTAMP(3),
    "contrato" TEXT NOT NULL,
    "objeto" TEXT,
    "locId" INTEGER,
    "locationUrl" TEXT,
    "pixCopiaECola" TEXT,
    "jornada" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixAutoRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixAutoSolicRec" (
    "id" TEXT NOT NULL,
    "recurrenceId" TEXT NOT NULL,
    "idSolicRec" TEXT,
    "status" TEXT NOT NULL,
    "dataExpiracao" TIMESTAMP(3) NOT NULL,
    "agencia" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "ispb" TEXT NOT NULL,
    "recPayload" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixAutoSolicRec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixAutoCobr" (
    "id" TEXT NOT NULL,
    "recurrenceId" TEXT NOT NULL,
    "txid" TEXT,
    "status" TEXT NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "valorOriginal" TEXT NOT NULL,
    "infoAdicional" TEXT,
    "ajusteDiaUtil" BOOLEAN NOT NULL DEFAULT false,
    "politicaRetentativa" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PixAutoCobr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EfiWebhookEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "EfiWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Participant_eventId_idx" ON "Participant"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_eventId_cpf_key" ON "Participant"("eventId", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoRecurrence_idRec_key" ON "PixAutoRecurrence"("idRec");

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoRecurrence_idempotencyKey_key" ON "PixAutoRecurrence"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PixAutoRecurrence_eventId_idx" ON "PixAutoRecurrence"("eventId");

-- CreateIndex
CREATE INDEX "PixAutoRecurrence_participantId_idx" ON "PixAutoRecurrence"("participantId");

-- CreateIndex
CREATE INDEX "PixAutoRecurrence_status_idx" ON "PixAutoRecurrence"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoSolicRec_idSolicRec_key" ON "PixAutoSolicRec"("idSolicRec");

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoSolicRec_idempotencyKey_key" ON "PixAutoSolicRec"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PixAutoSolicRec_recurrenceId_idx" ON "PixAutoSolicRec"("recurrenceId");

-- CreateIndex
CREATE INDEX "PixAutoSolicRec_status_dataExpiracao_idx" ON "PixAutoSolicRec"("status", "dataExpiracao");

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoCobr_txid_key" ON "PixAutoCobr"("txid");

-- CreateIndex
CREATE UNIQUE INDEX "PixAutoCobr_idempotencyKey_key" ON "PixAutoCobr"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PixAutoCobr_recurrenceId_idx" ON "PixAutoCobr"("recurrenceId");

-- CreateIndex
CREATE INDEX "PixAutoCobr_status_idx" ON "PixAutoCobr"("status");

-- CreateIndex
CREATE INDEX "PixAutoCobr_dataVencimento_idx" ON "PixAutoCobr"("dataVencimento");

-- CreateIndex
CREATE INDEX "EfiWebhookEvent_kind_receivedAt_idx" ON "EfiWebhookEvent"("kind", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EfiWebhookEvent_kind_externalId_key" ON "EfiWebhookEvent"("kind", "externalId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixAutoRecurrence" ADD CONSTRAINT "PixAutoRecurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixAutoRecurrence" ADD CONSTRAINT "PixAutoRecurrence_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixAutoSolicRec" ADD CONSTRAINT "PixAutoSolicRec_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "PixAutoRecurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PixAutoCobr" ADD CONSTRAINT "PixAutoCobr_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "PixAutoRecurrence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
