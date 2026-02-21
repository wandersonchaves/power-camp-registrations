import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { createJourney3UseCase } from "@/use-cases/pix-auto/create-journey3.use-case";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().min(1),
  participantId: z.string().min(1),

  immediateAmount: z.string().min(1),
  immediateTxid: z.string().optional(),

  contrato: z.string().min(1),
  objeto: z.string().optional(),
  periodicidade: z.string().min(1),
  dataInicial: z.string().min(10),
  dataFinal: z.string().min(10).optional(),
  valorRec: z.string().min(1),

  solicitacaoPagador: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const rec = await createJourney3UseCase(body);
    return NextResponse.json(rec, { status: 201 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
