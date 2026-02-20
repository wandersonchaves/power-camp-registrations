import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { createRecurrenceUseCase } from "@/use-cases/pix-auto/create-recurrence.use-case";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().min(1),
  participantId: z.string().min(1),
  contrato: z.string().min(1),
  objeto: z.string().optional(),
  dataInicial: z.string().min(10),
  dataFinal: z.string().min(10).optional(),
  periodicidade: z.string().min(1),
  valorRec: z.string().min(1),
  locId: z.number().int().optional(),
  ativacaoTxid: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const rec = await createRecurrenceUseCase(body);
    return NextResponse.json(rec, { status: 201 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
