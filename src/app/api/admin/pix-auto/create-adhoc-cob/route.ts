import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { toAppError } from "@/lib/http-errors";
import { createAdhocImmediateCobForRecurrenceUseCase } from "@/use-cases/pix-auto/create-adhoc-immediate-cob-for-recurrence.use-case";

export const runtime = "nodejs";

const schema = z.object({
  recurrenceId: z.string().min(1),
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.string().optional(),
  infoAdicional: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = schema.parse(await req.json());

    const result = await createAdhocImmediateCobForRecurrenceUseCase(body);

    return NextResponse.json(result);
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
