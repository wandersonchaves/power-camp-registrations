import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { syncMigrationStatus } from "@/use-cases/migration/sync-migration-status";

const schema = z.object({
  migrationId: z.string().cuid(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { migrationId } = schema.parse(body);

    const result = await syncMigrationStatus(migrationId);

    return NextResponse.json(result || { status: "NOT_FOUND" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Falha ao sincronizar";
    logger.error("Sync Migration Error", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
