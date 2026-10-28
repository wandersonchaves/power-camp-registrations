/** @jest-environment node */
import { mapEfiPixItem } from "@/infra/efi/pix-received.mapper";

const item = {
  endToEndId: "E18236120202603201822s14e73cdb49",
  txid: "f53cd8cf",
  valor: "933.30",
  horario: "2026-03-20T18:22:00.000Z",
};

describe("mapEfiPixItem", () => {
  it("normaliza valor em centavos e data", () => {
    expect(mapEfiPixItem(item)).toMatchObject({
      endToEndId: item.endToEndId,
      txid: "f53cd8cf",
      amountCents: 93330,
      paidAt: new Date(item.horario),
      payerName: null,
    });
  });

  it("lê pagador de gnExtras quando presente", () => {
    expect(
      mapEfiPixItem({
        ...item,
        gnExtras: { pagador: { nome: "FULANO", cnpj: "123" } },
      }),
    ).toMatchObject({ payerName: "FULANO", payerDocument: "123" });
  });

  it("txid ausente vira null", () => {
    expect(mapEfiPixItem({ ...item, txid: undefined })?.txid).toBeNull();
  });

  it.each([
    [{ ...item, endToEndId: "" }],
    [{ ...item, valor: "abc" }],
    [{ ...item, horario: "ontem" }],
    [{ ...item, horario: undefined }],
    ["x"],
    [null],
  ])("rejeita item inválido %#", (bad) => {
    expect(mapEfiPixItem(bad)).toBeNull();
  });
});
