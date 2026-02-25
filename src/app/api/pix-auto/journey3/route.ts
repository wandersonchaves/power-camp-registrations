// src/app/api/pix-auto/journey3/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { createEnrollmentAndStartJourney3UseCase } from "@/use-cases/enrollment/create-enrollment-and-start-journey3.use-case";

export const runtime = "nodejs";

const schema = z
  .object({
    eventId: z.string().min(1),
    participantId: z.string().min(1),

    immediateAmount: z.string().min(1),
    recurringAmount: z.string().min(1),

    // compat: aceitamos no payload, mas iremos normalizar/usar um contrato seguro
    contrato: z.string().optional().default(""),

    objeto: z.string().optional().nullable(),

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

    // compat: alguns clientes antigos podem mandar isso; ignoramos/transformamos em error explícito
    immediateTxid: z.string().optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());

    // Jornada 3 “pura” (POST /v2/cob) não suporta immediateTxid
    if (body.immediateTxid && body.immediateTxid.trim()) {
      return NextResponse.json(
        {
          error: "IMMEDIATE_TXID_NOT_SUPPORTED",
          message:
            "immediateTxid não é suportado no fluxo Jornada 3 'puro' (POST /v2/cob). Remova o campo ou use um fluxo separado com PUT /v2/cob/:txid.",
        },
        { status: 400 },
      );
    }

    const result = await createEnrollmentAndStartJourney3UseCase({
      eventId: body.eventId,
      participantId: body.participantId,

      // endpoint “pix-auto/journey3” não decide equipe
      teamCode: null,

      immediateAmount: body.immediateAmount,
      recurringAmount: body.recurringAmount,

      // se vier vazio, o use-case gera um contrato válido baseado no enrollment
      contrato: body.contrato,

      objeto: body.objeto ?? null,

      periodicidade: body.periodicidade,
      dataInicial: body.dataInicial,
      dataFinal: body.dataFinal,

      solicitacaoPagador: body.solicitacaoPagador,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
