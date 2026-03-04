import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { generateJ2Qr } from "@/use-cases/migration/generate-j2-qr";

const schema = z.object({
  recurrenceId: z.string().cuid(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recurrenceId } = schema.parse(body);

    const result = await generateJ2Qr(recurrenceId);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Falha ao gerar QR";
    logger.error("Migration QR Error", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
