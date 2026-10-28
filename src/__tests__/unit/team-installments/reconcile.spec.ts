/** @jest-environment node */
import { withRetry } from "@/infra/efi/pix-received.client";
import { EfiPixReceivedClient } from "@/infra/efi/pix-received.client";
import { isValidCronAuthorization } from "@/lib/auth/cron-secret";
import type { ReceivedPixItem } from "@/use-cases/team-installments/ports";
import { makeReconcileTeamPayments } from "@/use-cases/team-installments/reconcile-team-payments.use-case";

const UNIT = 93330;
const pix = (id: string, amountCents: number): ReceivedPixItem => ({
  endToEndId: id,
  txid: null,
  amountCents,
  paidAt: new Date("2026-10-20T10:00:00Z"),
  payerName: null,
  payerDocument: null,
});

describe("reconcileTeamPayments", () => {
  it("pagina, filtra múltiplos, conta e isola falhas", async () => {
    const pages = [
      { items: [pix("A", UNIT), pix("noise", 1000)], totalPages: 2 },
      { items: [pix("B", UNIT * 2), pix("C", UNIT)], totalPages: 2 },
    ];
    const fetchPage = jest.fn(
      async (r: { from: Date; to: Date; page: number }) => pages[r.page],
    );
    const record = jest.fn(async (i: { endToEndId?: string | null }) => {
      if (i.endToEndId === "C") throw new Error("db");
      return i.endToEndId === "B"
        ? ({ outcome: "EXISTING", paymentId: "x" } as const)
        : ({ outcome: "CREATED", paymentId: "y" } as const);
    });
    const now = new Date("2026-10-27T00:00:00Z");

    const report = await makeReconcileTeamPayments({
      source: { fetchPage, fetchByEndToEndId: jest.fn() },
      recordTeamPayment: record,
      installmentAmountCents: UNIT,
      now: () => now,
    })({ days: 7 });

    expect(report).toEqual({
      scanned: 4,
      candidates: 3,
      created: 1,
      existing: 1,
      failed: 1,
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage.mock.calls[0][0].from).toEqual(
      new Date("2026-10-20T00:00:00Z"),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ source: "RECONCILIATION" }),
    );
  });
});

describe("withRetry", () => {
  const err = (status?: number, retryAfter?: string) =>
    Object.assign(new Error("x"), {
      response: status
        ? { status, headers: retryAfter ? { "retry-after": retryAfter } : {} }
        : undefined,
    });
  const opts = () => ({
    sleep: jest.fn<Promise<void>, [number]>(async () => undefined),
    random: () => 0.5,
    baseDelayMs: 100,
  });

  it("repete em 429/5xx com backoff exponencial e respeita Retry-After", async () => {
    const o = opts();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(err(429, "3"))
      .mockRejectedValueOnce(err(503))
      .mockResolvedValue("ok");
    await expect(withRetry(fn, o)).resolves.toBe("ok");
    expect(o.sleep.mock.calls.map((c) => c[0] as number)).toEqual([3000, 200]);
  });

  it("não repete 4xx e desiste após o máximo de tentativas", async () => {
    const o = opts();
    const bad = jest.fn().mockRejectedValue(err(400));
    await expect(withRetry(bad, o)).rejects.toThrow();
    expect(bad).toHaveBeenCalledTimes(1);

    const down = jest.fn().mockRejectedValue(err(500));
    await expect(withRetry(down, { ...o, maxAttempts: 3 })).rejects.toThrow();
    expect(down).toHaveBeenCalledTimes(3);
  });
});

describe("EfiPixReceivedClient", () => {
  it("monta a query, mapeia itens e lê o total de páginas", async () => {
    const get = jest.fn().mockResolvedValue({
      data: {
        parametros: { paginacao: { quantidadeDePaginas: 3 } },
        pix: [
          {
            endToEndId: "E1",
            valor: "933.30",
            horario: "2026-10-20T10:00:00Z",
          },
          { lixo: true },
        ],
      },
    });
    const client = new EfiPixReceivedClient(() => ({ get }) as never);
    const from = new Date("2026-10-20T00:00:00Z");
    const to = new Date("2026-10-27T00:00:00Z");

    const page = await client.fetchPage({ from, to, page: 1 });

    expect(page.totalPages).toBe(3);
    expect(page.items).toHaveLength(1);
    expect(get).toHaveBeenCalledWith("/v2/pix", {
      params: expect.objectContaining({
        inicio: from.toISOString(),
        fim: to.toISOString(),
        "paginacao.paginaAtual": 1,
      }),
    });
  });
});

describe("isValidCronAuthorization", () => {
  it("aceita só o Bearer correto e nega sem segredo configurado", () => {
    expect(isValidCronAuthorization("Bearer s3cret", "s3cret")).toBe(true);
    expect(isValidCronAuthorization("Bearer outro", "s3cret")).toBe(false);
    expect(isValidCronAuthorization("s3cret", "s3cret")).toBe(false);
    expect(isValidCronAuthorization(null, "s3cret")).toBe(false);
    expect(isValidCronAuthorization("Bearer ", "")).toBe(false);
    expect(isValidCronAuthorization("Bearer x", undefined)).toBe(false);
  });
});
