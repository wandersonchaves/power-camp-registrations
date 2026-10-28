/** @jest-environment node */
import {
  EfiCobPayerLookup,
  EfiPixReceivedClient,
} from "@/infra/efi/pix-received.client";
import type {
  PaymentListRow,
  ReceivedPixItem,
  TeamInstallmentReadModel,
} from "@/use-cases/team-installments/ports";
import {
  makeConfirmManualWithEfi,
  makeRegisterEfiPayments,
} from "@/use-cases/team-installments/register-efi-payments.use-case";
import { makeSearchEfiPayments } from "@/use-cases/team-installments/search-efi-payments.use-case";

const UNIT = 93330;
const D = 24 * 60 * 60 * 1000;
const t0 = new Date("2026-09-20T12:00:00Z");

const pix = (id: string, amountCents = UNIT, over = {}): ReceivedPixItem => ({
  endToEndId: id,
  txid: null,
  amountCents,
  paidAt: t0,
  payerName: null,
  payerDocument: null,
  ...over,
});

const row = (over: Partial<PaymentListRow>): PaymentListRow => ({
  id: "m1",
  endToEndId: "MANUAL-x",
  txid: null,
  amountCents: UNIT,
  paidAt: t0,
  payerName: null,
  payerDocument: null,
  teamCode: "LEAO",
  source: "MANUAL",
  confirmation: "UNCONFIRMED",
  status: "ALLOCATED",
  attributionReason: null,
  note: null,
  ...over,
});

function setup(opts: {
  pages?: ReceivedPixItem[][];
  registered?: PaymentListRow[];
  unconfirmed?: PaymentListRow[];
  txidTeam?: string | null;
  payer?: { name: string; document: string } | null;
}) {
  const pages = opts.pages ?? [[]];
  const fetchPage = jest.fn(async ({ page }: { page: number }) => ({
    items: pages[page] ?? [],
    totalPages: pages.length,
  }));
  const readModel = {
    findPaymentsByEndToEndIds: jest.fn(
      async () =>
        new Map((opts.registered ?? []).map((r) => [r.endToEndId, r])),
    ),
    listTeams: jest.fn(async () => [
      { id: "t-a", code: "AGUIA" },
      { id: "t-l", code: "LEAO" },
    ]),
    listPayments: jest.fn(async () => opts.unconfirmed ?? []),
  } as unknown as TeamInstallmentReadModel;
  const findPayer = jest.fn(async () => opts.payer ?? null);

  const search = makeSearchEfiPayments({
    source: { fetchPage, fetchByEndToEndId: jest.fn() },
    cobPayers: { findPayer },
    readModel,
    txidTeams: { findTeamId: jest.fn(async () => opts.txidTeam ?? null) },
    aliases: { findTeamId: jest.fn(async () => null) },
    installmentAmountCents: UNIT,
  });
  return { search, fetchPage, findPayer };
}

const range = {
  from: new Date(t0.getTime() - 10 * D),
  to: new Date(t0.getTime() + D),
};

describe("searchEfiPayments", () => {
  it("lista só múltiplos da parcela, sem duplicar, com nº de parcelas", async () => {
    const { search } = setup({
      pages: [
        [pix("E1"), pix("Enoise", 1000)],
        [pix("E2", UNIT * 2), pix("E1")],
      ],
    });
    const { candidates } = await search(range);
    expect(candidates.map((c) => [c.endToEndId, c.installments])).toEqual([
      ["E1", 1],
      ["E2", 2],
    ]);
  });

  it("marca os já registrados e não os sugere de novo", async () => {
    const { search, findPayer } = setup({
      pages: [[pix("E1", UNIT, { txid: "tx1" })]],
      registered: [
        row({ endToEndId: "E1", confirmation: "CONFIRMED", source: "WEBHOOK" }),
      ],
    });
    const [c] = (await search(range)).candidates;
    expect(c.registered).toMatchObject({
      teamCode: "LEAO",
      confirmation: "CONFIRMED",
    });
    expect(c.suggestedTeamCode).toBeNull();
    expect(findPayer).not.toHaveBeenCalled();
  });

  it("enriquece o responsável pelo devedor da cobrança, mascara o documento e sugere a equipe pelo txid", async () => {
    const { search } = setup({
      pages: [[pix("E1", UNIT, { txid: "tx1" })]],
      txidTeam: "t-a",
      payer: { name: "Fulano de Tal", document: "12345678901" },
    });
    const [c] = (await search(range)).candidates;
    expect(c.payerName).toBe("Fulano de Tal");
    expect(c.payerDocumentMasked).toBe("•••••••••01");
    expect(JSON.stringify(c)).not.toContain("12345678901");
    expect(c.suggestedTeamCode).toBe("AGUIA");
    expect(c.suggestionReason).toMatch(/txid/);
  });

  it("sugere correspondência com lançamento manual de mesmo valor e data próxima", async () => {
    const manual = row({ id: "m1", paidAt: new Date(t0.getTime() - 2 * D) });
    const { search } = setup({
      pages: [[pix("E1")]],
      unconfirmed: [manual],
    });
    const [c] = (await search(range)).candidates;
    expect(c.manualMatch).toEqual({ paymentId: "m1", teamCode: "LEAO" });

    const far = setup({
      pages: [[pix("E1")]],
      unconfirmed: [row({ paidAt: new Date(t0.getTime() - 30 * D) })],
    });
    expect((await far.search(range)).candidates[0].manualMatch).toBeNull();

    const ambiguous = setup({
      pages: [[pix("E1")]],
      unconfirmed: [row({ id: "a" }), row({ id: "b" })],
    });
    expect(
      (await ambiguous.search(range)).candidates[0].manualMatch,
    ).toBeNull();
  });

  it("divide períodos longos em janelas de 30 dias e rejeita períodos inválidos", async () => {
    const { search, fetchPage } = setup({});
    await search({
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-03-15T00:00:00Z"),
    });
    expect(fetchPage).toHaveBeenCalledTimes(3);

    await expect(search({ from: range.to, to: range.from })).rejects.toThrow();
    await expect(
      search({ from: new Date("2020-01-01"), to: new Date("2026-01-01") }),
    ).rejects.toThrow();
  });
});

describe("registerEfiPayments", () => {
  it("reconsulta a Efí e grava os dados autoritativos, não os do navegador", async () => {
    const fetchByEndToEndId = jest.fn(async (id: string) =>
      id === "E404x" ? null : pix(id, UNIT * 2, { txid: "tx1" }),
    );
    const record = jest.fn(
      async () => ({ outcome: "CREATED", paymentId: "p" }) as const,
    );
    const register = makeRegisterEfiPayments({
      source: { fetchPage: jest.fn(), fetchByEndToEndId },
      cobPayers: {
        findPayer: async () => ({ name: "Devedor", document: null }),
      },
      recordTeamPayment: record,
    });

    const res = await register({
      picks: [
        { endToEndId: "EOKxxxxxxxxxx", teamId: "t-l" },
        { endToEndId: "E404x", teamId: null },
      ],
      userEmail: "admin@x.com",
    });

    expect(res.map((r) => r.ok)).toEqual([true, false]);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: UNIT * 2,
        payerName: "Devedor",
        source: "RECONCILIATION",
        confirmation: "CONFIRMED",
        teamId: "t-l",
        userEmail: "admin@x.com",
      }),
    );
  });
});

describe("confirmManualWithEfi", () => {
  const make = (efi: ReceivedPixItem | null, manual: PaymentListRow | null) => {
    const promotePayment = jest.fn(async () => ({ paymentId: "m1" }));
    const run = makeConfirmManualWithEfi({
      source: { fetchPage: jest.fn(), fetchByEndToEndId: async () => efi },
      readModel: {
        getPayment: async () => manual,
      } as unknown as TeamInstallmentReadModel,
      promotePayment,
    });
    return { run, promotePayment };
  };
  const args = { paymentId: "m1", endToEndId: "E1", userEmail: null };

  it("promove quando o valor bate", async () => {
    const { run, promotePayment } = make(pix("E1"), row({}));
    await run(args);
    expect(promotePayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "m1", realEndToEndId: "E1" }),
    );
  });

  it("recusa valor diferente, Pix inexistente ou lançamento que não é manual", async () => {
    await expect(make(pix("E1", UNIT * 2), row({})).run(args)).rejects.toThrow(
      /valor/,
    );
    await expect(make(null, row({})).run(args)).rejects.toThrow(/Efí/);
    await expect(
      make(pix("E1"), row({ source: "WEBHOOK" })).run(args),
    ).rejects.toThrow();
  });
});

describe("EfiPixReceivedClient.fetchByEndToEndId", () => {
  const ok = {
    endToEndId: "E1234567890",
    valor: "933.30",
    horario: "2026-09-20T12:00:00Z",
  };

  it("mapeia o Pix e devolve null em 404", async () => {
    const get = jest.fn().mockResolvedValueOnce({ data: ok });
    const client = new EfiPixReceivedClient(() => ({ get }) as never);
    expect((await client.fetchByEndToEndId("E1234567890"))?.amountCents).toBe(
      93330,
    );
    expect(get).toHaveBeenCalledWith("/v2/pix/E1234567890");

    const notFound = jest.fn().mockRejectedValue({ response: { status: 404 } });
    const c2 = new EfiPixReceivedClient(() => ({ get: notFound }) as never);
    expect(await c2.fetchByEndToEndId("E1234567890")).toBeNull();
  });

  it("não chama a API com e2eId malformado", async () => {
    const get = jest.fn();
    const client = new EfiPixReceivedClient(() => ({ get }) as never);
    expect(await client.fetchByEndToEndId("../../v2/cob")).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});

describe("EfiCobPayerLookup", () => {
  it("devolve o devedor e nunca lança", async () => {
    const lookup = new EfiCobPayerLookup(async () => ({
      devedor: { nome: " Ana ", cnpj: "123" },
    }));
    expect(await lookup.findPayer("tx")).toEqual({
      name: "Ana",
      document: "123",
    });
    const broken = new EfiCobPayerLookup(async () => {
      throw new Error("efi down");
    });
    expect(await broken.findPayer("tx")).toBeNull();
  });
});
