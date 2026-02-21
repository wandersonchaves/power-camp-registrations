import type { EnrollmentStatus, PaymentStatus, TeamCode } from "@prisma/client";

export type TeamScore = Readonly<{
  teamCode: TeamCode | null;
  teamName: string;
  confirmed: number;
  pending: number;
  milestone50: {
    achievedAt: Date;
    txid: string;
    enrollmentId: string;
  } | null;
}>;

export type RaceScoreboard = Readonly<{
  eventId: string;
  teams: ReadonlyArray<TeamScore>;
  award: {
    winnerTeamCode: TeamCode;
    winnerTeamName: string;
    pointsGranted: number;
    decidedAt: Date;
    decidedByRule: string;
    tieBreakNote: string | null;
  } | null;
}>;

export type EnrollmentRow = Readonly<{
  enrollmentId: string;
  status: EnrollmentStatus;
  reservedAt: Date;
  confirmedAt: Date | null;

  teamCode: TeamCode | null; // ✅ aqui
  teamName: string;

  participantId: string;
  participantName: string;
  participantCpf: string;

  initialPayment: {
    txid: string | null;
    status: PaymentStatus;
    amount: string;
    paidAt: Date | null;
  } | null;
}>;
