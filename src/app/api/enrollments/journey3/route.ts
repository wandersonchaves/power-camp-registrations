import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { createEnrollmentAndStartJourney3UseCase } from "@/use-cases/enrollment/create-enrollment-and-start-journey3.use-case";

export const runtime = "nodejs";

const schema = z.object({
  eventId: z.string().min(1),
  participantId: z.string().min(1),
  teamCode: z.enum(["AGUIA", "LEAO"]),

  immediateAmount: z.string().min(1),
  recurringAmount: z.string().min(1),

  contrato: z.string().min(1),
  objeto: z.string().optional(),
  periodicidade: z.string().min(1),
  dataInicial: z.string().min(10),
  dataFinal: z.string().min(10).optional(),

  solicitacaoPagador: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const res = await createEnrollmentAndStartJourney3UseCase(body);
    return NextResponse.json(res, { status: 201 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
