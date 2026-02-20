import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/http-errors";
import { cancelCobrUseCase } from "@/use-cases/pix-auto/cancel-cobr.use-case";
import { createCobrUseCase } from "@/use-cases/pix-auto/create-cobr.use-case";

export const runtime = "nodejs";

const createSchema = z.object({
  recurrenceId: z.string().min(1),
  dataDeVencimento: z.string().min(10),
  valorOriginal: z.string().min(1),
  infoAdicional: z.string().optional(),
  ajusteDiaUtil: z.boolean().optional(),
  txid: z.string().optional(),
  devedor: z
    .object({
      cep: z.string().optional(),
      cidade: z.string().optional(),
      email: z.string().optional(),
      logradouro: z.string().optional(),
      uf: z.string().optional(),
    })
    .optional(),
  recebedor: z
    .object({
      agencia: z.string().optional(),
      conta: z.string().optional(),
      tipoConta: z.string().optional(),
    })
    .optional(),
});

const cancelSchema = z.object({ txid: z.string().min(5) });

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const cob = await createCobrUseCase(body);
    return NextResponse.json(cob, { status: 201 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = cancelSchema.parse(await req.json());
    const cob = await cancelCobrUseCase(body.txid);
    return NextResponse.json(cob, { status: 200 });
  } catch (e) {
    const err = toAppError(e);
    return NextResponse.json(
      { error: err.code, message: err.message, details: err.details },
      { status: err.statusCode },
    );
  }
}
