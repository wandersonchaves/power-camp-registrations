import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { createEnrollmentAndStartJourney3UseCase } from "@/use-cases/enrollment/create-enrollment-and-start-journey3.use-case";

const schema = z.object({
  eventId: z.string().min(1),
  participantId: z.string().min(1),

  // ✅ se você não quiser permitir time por API quando antecipada, pode remover daqui também
  teamCode: z.enum(["AGUIA", "LEAO"]).nullable().optional(),

  immediateAmount: z.string().regex(/^\d{1,10}\.\d{2}$/),
  recurringAmount: z.string().regex(/^\d{1,10}\.\d{2}$/),

  contrato: z.string().min(1),
  objeto: z.string().optional(),

  // ✅ corrigido: agora bate com o tipo do use-case
  periodicidade: z.enum([
    "MENSAL",
    "SEMANAL",
    "TRIMESTRAL",
    "SEMESTRAL",
    "ANUAL",
  ]),
  dataInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFinal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

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
