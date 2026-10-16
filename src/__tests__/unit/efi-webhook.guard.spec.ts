/**
 * @jest-environment node
 */
import { assertEfiWebhookAllowed } from "@/infra/efi/webhooks/efi-webhook.guard";

const BASE = "https://example.test/api/webhooks/efi/pix";

function post(url: string) {
  return new Request(url, { method: "POST", body: "{}" });
}

describe("assertEfiWebhookAllowed", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, EFI_WEBHOOK_HMAC: "s3cret-value" };
    delete process.env.EFI_WEBHOOK_ALLOW_IPS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("accepts a request with the correct hmac", () => {
    expect(() =>
      assertEfiWebhookAllowed(post(`${BASE}?hmac=s3cret-value`)),
    ).not.toThrow();
  });

  it("accepts the hmac when Efí appends a path through ?ignorar=", () => {
    expect(() =>
      assertEfiWebhookAllowed(post(`${BASE}?hmac=s3cret-value&ignorar=/pix`)),
    ).not.toThrow();
  });

  it("rejects a request with a wrong hmac", () => {
    expect(() => assertEfiWebhookAllowed(post(`${BASE}?hmac=wrong`))).toThrow(
      /hmac inválido/,
    );
  });

  it("rejects a hmac that only shares a prefix with the secret", () => {
    expect(() =>
      assertEfiWebhookAllowed(post(`${BASE}?hmac=s3cret-value-extra`)),
    ).toThrow(/hmac inválido/);
  });

  it("rejects a request without hmac", () => {
    expect(() => assertEfiWebhookAllowed(post(BASE))).toThrow(/hmac ausente/);
  });

  it("rejects every request when EFI_WEBHOOK_HMAC is not set", () => {
    delete process.env.EFI_WEBHOOK_HMAC;
    expect(() => assertEfiWebhookAllowed(post(`${BASE}?hmac=`))).toThrow(
      /EFI_WEBHOOK_HMAC não definido/,
    );
    expect(() =>
      assertEfiWebhookAllowed(post(`${BASE}?hmac=anything`)),
    ).toThrow(/EFI_WEBHOOK_HMAC não definido/);
  });
});
