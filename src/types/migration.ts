import { Prisma } from "@prisma/client";

export type MigrationStatus =
  | "PENDING_CONSENT"
  | "QR_GENERATED"
  | "SENT"
  | "CONSENT_ACCEPTED"
  | "CONSENT_REJECTED"
  | "FAILED"
  | "CANCELED"
  | "NOT_STARTED";

export interface MigrationAuditLog {
  id: string;
  migrationId: string;
  action: string;
  payload?: Prisma.JsonValue;
  userEmail?: string | null;
  createdAt: string | Date;
}

export interface MigrationData {
  id: string;
  status: MigrationStatus;
  attempts: number;
  lastError?: Prisma.JsonValue;
  createdAt: string | Date;
  updatedAt: string | Date;
  auditLogs?: MigrationAuditLog[];
}

export interface RecurrenceWithMigration {
  id: string;
  contrato: string;
  jornada: string | null;
  participant: {
    fullName: string;
    phone: string | null;
  };
  migration: MigrationData | null;
}
