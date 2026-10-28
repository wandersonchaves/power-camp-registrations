/** @jest-environment node */
import {
  formatCents,
  isExactMultiple,
  parseReaisToCents,
} from "@/domain/team-installments/money";
import { normalizePayerName } from "@/domain/team-installments/normalize-name";

describe("money", () => {
  it.each([
    ["933.30", 93330],
    ["933,30", 93330],
    ["933", 93300],
    ["0.1", 10],
    ["19.99", 1999],
  ])("parseReaisToCents(%s)", (input, expected) => {
    expect(parseReaisToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "-1.00", "1.234", "0", "0.00", null, 933.3])(
    "rejeita %p",
    (input) => {
      expect(parseReaisToCents(input)).toBeNull();
    },
  );

  it("múltiplo exato", () => {
    expect(isExactMultiple(186660, 93330)).toBe(true);
    expect(isExactMultiple(36600, 93330)).toBe(false);
    expect(isExactMultiple(0, 93330)).toBe(false);
  });

  it("formatCents", () => {
    expect(formatCents(93330)).toBe("R$ 933,30");
    expect(formatCents(123456789)).toBe("R$ 1.234.567,89");
    expect(formatCents(5)).toBe("R$ 0,05");
  });
});

describe("normalizePayerName", () => {
  it("remove acento, pontuação e espaços extras", () => {
    expect(normalizePayerName("  José  da Silva-LTDA. ")).toBe(
      "jose da silva ltda",
    );
    expect(normalizePayerName("CODAR.PRO LTDA")).toBe("codar pro ltda");
  });
});
