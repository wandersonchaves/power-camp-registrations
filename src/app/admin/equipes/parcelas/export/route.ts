// CSV da matriz equipe × mês. Sem documento/nome de pagador.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { toCsv } from "@/domain/team-installments/csv";
import { getTeamInstallments } from "@/infra/team-installments/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_LABEL = {
  PAID: "PAGO",
  PAID_UNCONFIRMED: "PAGO NAO CONFIRMADO",
  OVERDUE: "ABERTO",
  UPCOMING: "A VENCER",
} as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isActive || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { matrices } = await getTeamInstallments().getInstallmentOverview();
  const rows: (string | number)[][] = [
    ["equipe", "vencimento", "valor_centavos", "situacao"],
  ];
  for (const m of matrices) {
    for (const c of m.cells) {
      rows.push([
        m.teamCode,
        c.dueMonth.toISOString().slice(0, 10),
        c.amountCents,
        STATE_LABEL[c.state],
      ]);
    }
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="parcelas-equipes.csv"',
      "Cache-Control": "no-store",
    },
  });
}
