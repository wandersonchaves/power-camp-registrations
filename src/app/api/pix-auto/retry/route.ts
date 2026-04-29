import { NextResponse } from "next/server";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { prisma } from "@/lib/prisma";
import { asInputJson } from "@/lib/prisma-json";

export async function POST(req: Request) {
  try {
    const { txid, date } = await req.json();

    if (!txid || !date) {
      return NextResponse.json(
        { error: "TXID e Data são obrigatórios" },
        { status: 400 },
      );
    }

    // 1. Chamar a EFI para retentativa
    const efiResponse = await pixAutoClient.cobr.retry(txid, date);

    // 2. Atualizar o banco local com o novo payload e status
    await prisma.pixAutoCobr.update({
      where: { txid },
      data: {
        status: "AGENDADA", // Ao retentar, ela volta a ser agendada para a nova data
        payload: asInputJson(efiResponse),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RETRY-API]", error);
    return NextResponse.json(
      { error: "Falha na retentativa" },
      { status: 500 },
    );
  }
}
