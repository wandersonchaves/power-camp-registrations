import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { createSolicRecUseCase } from "@/use-cases/pix-auto/create-solicrec.use-case";

export const runtime = "nodejs";

const schema = z.object({
  recurrenceId: z.string().min(1),
  dataExpiracaoSolicitacaoISO: z.string().min(10),
  destinatario: z.object({
    agencia: z.string().min(1),
    conta: z.string().min(1),
    cpf: z.string().min(11),
    ispbParticipante: z.string().min(3),
  }),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const solic = await createSolicRecUseCase(body);
    return NextResponse.json(solic, { status: 201 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
