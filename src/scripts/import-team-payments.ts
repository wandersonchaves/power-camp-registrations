// src/scripts/import-team-payments.ts
// Uso: pnpm import:team-payments <arquivo.csv> [--apply]
// Sem --apply é sempre dry-run (apenas leitura do banco). Nunca imprime nome de pagador.
import { readFileSync } from "node:fs";

import { formatCents } from "@/domain/team-installments/money";
import { getTeamInstallmentConfig } from "@/infra/team-installments/config";
import { buildTeamInstallments } from "@/infra/team-installments/container";
import { prisma } from "@/lib/prisma";
import { makeImportTeamPayments } from "@/use-cases/team-installments/import-team-payments.use-case";
import { parsePaymentsCsv } from "@/use-cases/team-installments/parse-payments-csv";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  if (!file)
    throw new Error("Uso: import:team-payments <arquivo.csv> [--apply]");

  const { rows, errors } = parsePaymentsCsv(readFileSync(file, "utf8"));
  for (const e of errors) console.error(`linha ${e.line}: ${e.message}`);
  if (errors.length > 0) {
    throw new Error("CSV inválido: nada foi importado");
  }

  const teams = await prisma.team.findMany({
    select: { id: true, code: true },
  });
  const teamIdByCode = Object.fromEntries(
    teams.map((t) => [t.code, t.id]),
  ) as Record<"AGUIA" | "LEAO", string>;
  if (!teamIdByCode.AGUIA || !teamIdByCode.LEAO) {
    throw new Error("Equipes AGUIA/LEAO não encontradas (rode o seed)");
  }

  const { installmentAmountCents } = getTeamInstallmentConfig();
  const { recordTeamPayment } = buildTeamInstallments(prisma);

  const importTeamPayments = makeImportTeamPayments({
    recordTeamPayment,
    paymentExists: async (endToEndId) =>
      (await prisma.teamPayment.count({ where: { endToEndId } })) > 0,
    teamIdByCode,
    installmentAmountCents,
  });

  const host = new URL(process.env.DATABASE_URL ?? "postgresql://?").hostname;
  console.log(
    `${apply ? "APLICANDO" : "DRY-RUN"} — ${rows.length} linha(s) — banco: ${host}`,
  );

  const reports = await importTeamPayments({ rows, apply });
  for (const r of reports) {
    console.log(
      [
        `L${r.line}`,
        r.endToEndId.slice(0, 36),
        formatCents(r.amountCents),
        r.teamCode ?? "-",
        r.action,
        r.outcome ?? "",
        r.error ?? "",
      ]
        .filter(Boolean)
        .join("  "),
    );
  }

  if (!apply) console.log("\nNada foi gravado. Use --apply para importar.");
  if (reports.some((r) => r.action === "ERROR")) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
