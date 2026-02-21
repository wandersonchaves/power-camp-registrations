-- CreateEnum
CREATE TYPE "TeamCode" AS ENUM ('AGUIA', 'LEAO');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'ACTIVE', 'PAID', 'CANCELLED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "code" "TeamCode" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitialPaymentAttempt" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "txid" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "createdAtEfi" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "amount" TEXT NOT NULL,
    "payload" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitialPaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMilestone" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "milestone" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamAward" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "awardKey" TEXT NOT NULL,
    "winnerTeamId" TEXT NOT NULL,
    "pointsGranted" INTEGER NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "decidedByRule" TEXT NOT NULL,
    "tieBreakNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code");

-- CreateIndex
CREATE INDEX "Enrollment_eventId_teamId_status_idx" ON "Enrollment"("eventId", "teamId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_teamId_status_idx" ON "Enrollment"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_eventId_participantId_key" ON "Enrollment"("eventId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "InitialPaymentAttempt_enrollmentId_key" ON "InitialPaymentAttempt"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "InitialPaymentAttempt_txid_key" ON "InitialPaymentAttempt"("txid");

-- CreateIndex
CREATE UNIQUE INDEX "InitialPaymentAttempt_idempotencyKey_key" ON "InitialPaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InitialPaymentAttempt_status_paidAt_idx" ON "InitialPaymentAttempt"("status", "paidAt");

-- CreateIndex
CREATE INDEX "TeamMilestone_eventId_milestone_achievedAt_idx" ON "TeamMilestone"("eventId", "milestone", "achievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMilestone_eventId_teamId_milestone_key" ON "TeamMilestone"("eventId", "teamId", "milestone");

-- CreateIndex
CREATE INDEX "TeamAward_eventId_decidedAt_idx" ON "TeamAward"("eventId", "decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamAward_eventId_awardKey_key" ON "TeamAward"("eventId", "awardKey");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialPaymentAttempt" ADD CONSTRAINT "InitialPaymentAttempt_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMilestone" ADD CONSTRAINT "TeamMilestone_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMilestone" ADD CONSTRAINT "TeamMilestone_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAward" ADD CONSTRAINT "TeamAward_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamAward" ADD CONSTRAINT "TeamAward_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
