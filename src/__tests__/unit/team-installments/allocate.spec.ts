/** @jest-environment node */
import { allocate } from "@/domain/team-installments/allocate";
import type {
  InstallmentInput,
  PaymentInput,
} from "@/domain/team-installments/types";

const UNIT = 93330;
const opts = { installmentAmountCents: UNIT };

const installments = (teamId: string): InstallmentInput[] =>
  Array.from({ length: 9 }, (_, i) => ({
    id: `${teamId}-i${i + 1}`,
    teamId,
    dueMonth: new Date(Date.UTC(2026, 3 + i, 10)),
    amountCents: UNIT,
  }));

const all = [...installments("A"), ...installments("L")];

const pay = (
  id: string,
  amountCents: number,
  day: number,
  teamId: string | null = "A",
): PaymentInput => ({
  id,
  endToEndId: `E${id}`,
  amountCents,
  paidAt: new Date(Date.UTC(2026, 4, day)),
  teamId,
});

const byId = (r: ReturnType<typeof allocate>) =>
  Object.fromEntries(r.map((x) => [x.paymentId, x]));

describe("allocate", () => {
  it("quita a parcela aberta mais antiga (FIFO)", () => {
    const r = byId(
      allocate([pay("p1", UNIT, 1), pay("p2", UNIT, 2)], all, opts),
    );
    expect(r.p1.allocations.map((a) => a.installmentId)).toEqual(["A-i1"]);
    expect(r.p2.allocations.map((a) => a.installmentId)).toEqual(["A-i2"]);
    expect(r.p1.status).toBe("ALLOCATED");
  });

  it("2x a parcela quita dois meses seguidos", () => {
    const [r] = allocate([pay("p1", UNIT * 2, 1)], all, opts);
    expect(r.allocations.map((a) => a.installmentId)).toEqual(["A-i1", "A-i2"]);
    expect(r.unallocatedCents).toBe(0);
  });

  it("valor não múltiplo vira IGNORED e não consome parcela", () => {
    const r = byId(
      allocate([pay("p1", 18300, 1), pay("p2", UNIT, 2)], all, opts),
    );
    expect(r.p1).toMatchObject({
      status: "IGNORED",
      reason: "NOT_MULTIPLE_OF_INSTALLMENT",
      unallocatedCents: 18300,
    });
    expect(r.p2.allocations[0].installmentId).toBe("A-i1");
  });

  it("registra a sobra quando não há parcelas abertas", () => {
    const [r] = allocate([pay("p1", UNIT * 10, 1)], all, opts);
    expect(r.allocations).toHaveLength(9);
    expect(r.status).toBe("PARTIAL");
    expect(r.unallocatedCents).toBe(UNIT);
  });

  it("sem equipe fica UNATTRIBUTED e não aloca", () => {
    const [r] = allocate([pay("p1", UNIT, 1, null)], all, opts);
    expect(r).toMatchObject({ status: "UNATTRIBUTED", allocations: [] });
    expect(r.unallocatedCents).toBe(UNIT);
  });

  it("equipes não competem pelas mesmas parcelas", () => {
    const r = byId(
      allocate([pay("p1", UNIT, 1, "A"), pay("p2", UNIT, 1, "L")], all, opts),
    );
    expect(r.p1.allocations[0].installmentId).toBe("A-i1");
    expect(r.p2.allocations[0].installmentId).toBe("L-i1");
  });

  it("reexecução idêntica dá o mesmo resultado", () => {
    const input = [pay("p1", UNIT, 1), pay("p2", UNIT * 2, 3)];
    expect(allocate(input, all, opts)).toEqual(allocate(input, all, opts));
  });

  it("ordem de chegada diferente dá o mesmo resultado final", () => {
    const input = [
      pay("p1", UNIT, 1),
      pay("p2", UNIT * 2, 3),
      pay("p3", UNIT, 5),
    ];
    const reversed = [...input].reverse();
    expect(byId(allocate(reversed, all, opts))).toEqual(
      byId(allocate(input, all, opts)),
    );
  });

  it("não muta as entradas", () => {
    const input = [pay("p2", UNIT, 3), pay("p1", UNIT, 1)];
    const snapshot = input.map((p) => p.id);
    allocate(input, all, opts);
    expect(input.map((p) => p.id)).toEqual(snapshot);
  });
});
