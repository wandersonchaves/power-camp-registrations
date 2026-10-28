/** @jest-environment node */
import { recordTeamPaymentsFromWebhook } from "@/infra/team-installments/webhook-ingest";

const ok = {
  endToEndId: "E1",
  valor: "933.30",
  horario: "2026-03-20T18:22:00.000Z",
};

describe("recordTeamPaymentsFromWebhook", () => {
  const OLD = process.env.TEAM_INSTALLMENTS_ENABLED;
  afterEach(() => {
    process.env.TEAM_INSTALLMENTS_ENABLED = OLD;
    jest.restoreAllMocks();
  });

  it("não faz nada com a feature flag desligada", async () => {
    process.env.TEAM_INSTALLMENTS_ENABLED = "false";
    const record = jest.fn();
    await recordTeamPaymentsFromWebhook([ok], () => record);
    expect(record).not.toHaveBeenCalled();
  });

  it("falha em um item não impede os demais nem lança", async () => {
    process.env.TEAM_INSTALLMENTS_ENABLED = "true";
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const record = jest
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({ outcome: "CREATED", paymentId: "p" });

    await expect(
      recordTeamPaymentsFromWebhook(
        [ok, { ...ok, endToEndId: "E2" }, { invalid: true }],
        () => record,
      ),
    ).resolves.toBeUndefined();

    expect(record).toHaveBeenCalledTimes(2);
    expect(record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        endToEndId: "E2",
        amountCents: 93330,
        source: "WEBHOOK",
      }),
    );
  });

  it("erro ao montar o serviço é engolido", async () => {
    process.env.TEAM_INSTALLMENTS_ENABLED = "true";
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      recordTeamPaymentsFromWebhook([ok], () => {
        throw new Error("boom");
      }),
    ).resolves.toBeUndefined();
  });
});
