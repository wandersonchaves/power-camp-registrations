/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parsePaymentsCsv } from "@/use-cases/team-installments/parse-payments-csv";

const HEADER = "e2eid,data,valor,equipe,pagador,origem,confirmacao\n";

describe("parsePaymentsCsv", () => {
  it("lê linha válida com defaults", () => {
    const { rows, errors } = parsePaymentsCsv(
      `${HEADER}E1,2026-03-20T18:22:00Z,"933,30",leao,,,\n`,
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      endToEndId: "E1",
      amountCents: 93330,
      teamCode: "LEAO",
      source: "IMPORT",
      confirmation: "CONFIRMED",
    });
  });

  it("ignora comentários, BOM e CRLF; aceita campo com aspas e vírgula", () => {
    const csv = `${String.fromCharCode(0xfeff)}# nota\r\n${HEADER}E1,2026-03-20T18:22:00Z,933.30,AGUIA,"ACME, LTDA",MANUAL,UNCONFIRMED\r\n`;
    const { rows, errors } = parsePaymentsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      payerName: "ACME, LTDA",
      source: "MANUAL",
      confirmation: "UNCONFIRMED",
    });
  });

  it("reporta erros por linha sem abortar as válidas", () => {
    const { rows, errors } = parsePaymentsCsv(
      `${HEADER}E1,2026-03-20T18:22:00Z,abc,AGUIA,,,\nE2,ontem,933.30,AGUIA,,,\nE3,2026-03-20T18:22:00Z,933.30,XXX,,,\nE4,2026-03-20T18:22:00Z,933.30,AGUIA,,,\n`,
    );
    expect(rows.map((r) => r.endToEndId)).toEqual(["E4"]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  it("exige colunas obrigatórias", () => {
    expect(parsePaymentsCsv("a,b\n1,2\n").errors[0].message).toMatch(/data/);
  });

  it("a carga inicial versionada é válida (6 linhas, 1 sem e2eId)", () => {
    const csv = readFileSync(
      join(process.cwd(), "src/scripts/data/team-payments.initial.csv"),
      "utf8",
    );
    const { rows, errors } = parsePaymentsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.endToEndId === null)).toHaveLength(1);
    expect(rows.every((r) => r.amountCents === 93330)).toBe(true);
  });
});
