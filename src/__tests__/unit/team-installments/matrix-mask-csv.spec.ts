/** @jest-environment node */
import { toCsv } from "@/domain/team-installments/csv";
import {
  buildInstallmentMatrix,
  type MatrixInstallmentInput,
} from "@/domain/team-installments/installment-matrix";
import { maskDocument } from "@/domain/team-installments/mask";

const UNIT = 93330;
const inst = (
  id: string,
  teamCode: string,
  month: number,
  payment: MatrixInstallmentInput["payment"],
): MatrixInstallmentInput => ({
  id,
  teamId: `t-${teamCode}`,
  teamCode,
  dueMonth: new Date(Date.UTC(2026, month, 10)),
  amountCents: UNIT,
  payment,
});

describe("buildInstallmentMatrix", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const matrix = buildInstallmentMatrix(
    [
      inst("a3", "AGUIA", 5, null), // jun: vencida
      inst("a1", "AGUIA", 3, { id: "p1", confirmation: "CONFIRMED" }),
      inst("a2", "AGUIA", 4, { id: "p2", confirmation: "UNCONFIRMED" }),
      inst("a4", "AGUIA", 6, null), // jul: a vencer
      inst("l1", "LEAO", 3, null),
    ],
    now,
  );

  it("classifica estados e ordena por mês dentro da equipe", () => {
    const aguia = matrix.find((m) => m.teamCode === "AGUIA");
    expect(aguia?.cells.map((c) => c.state)).toEqual([
      "PAID",
      "PAID_UNCONFIRMED",
      "OVERDUE",
      "UPCOMING",
    ]);
    expect(matrix.map((m) => m.teamCode)).toEqual(["AGUIA", "LEAO"]);
  });

  it("totaliza pago, não confirmado, em aberto e a vencer", () => {
    expect(matrix[0].totals).toEqual({
      paidCents: UNIT * 2,
      unconfirmedCents: UNIT,
      overdueCents: UNIT,
      upcomingCents: UNIT,
    });
    expect(matrix[1].totals.overdueCents).toBe(UNIT);
  });

  it("vence só ao fim do dia do vencimento", () => {
    const due = [inst("x", "AGUIA", 5, null)];
    expect(
      buildInstallmentMatrix(due, new Date("2026-06-10T23:00:00Z"))[0].cells[0]
        .state,
    ).toBe("UPCOMING");
    expect(
      buildInstallmentMatrix(due, new Date("2026-06-11T00:00:00Z"))[0].cells[0]
        .state,
    ).toBe("OVERDUE");
  });
});

describe("maskDocument", () => {
  it("nunca devolve o documento completo", () => {
    expect(maskDocument("123.456.789-01")).toBe("•••••••••01");
    expect(maskDocument("12345678000199")).toBe("•••••••••99");
    expect(maskDocument("123")).toBe("••••");
    expect(maskDocument(null)).toBeNull();
    expect(maskDocument("12345678901")).not.toContain("345");
  });
});

describe("toCsv", () => {
  it("escapa vírgulas/aspas e neutraliza fórmulas", () => {
    expect(toCsv([["a,b", 'x"y', "=SUM(A1)", null, 5]])).toBe(
      '"a,b","x""y",\'=SUM(A1),,5\n',
    );
  });
});
