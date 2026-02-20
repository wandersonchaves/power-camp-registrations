import { z } from "zod";

const envSchema = z.object({
  EFI_ENV: z.enum(["homolog", "prod"]).default("homolog"),
  EFI_CLIENT_ID: z.string().min(5),
  EFI_CLIENT_SECRET: z.string().min(5),
  EFI_CERT_P12_BASE64: z.string().min(20),
  EFI_CERT_P12_PASSPHRASE: z.string().optional().default(""),
});

export type EfiConfig = {
  env: "homolog" | "prod";
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  p12: Buffer;
  passphrase: string;
};

export function getEfiConfig(): EfiConfig {
  const parsed = envSchema.parse(process.env);

  const baseUrl =
    parsed.EFI_ENV === "prod"
      ? "https://pix.api.efipay.com.br"
      : "https://pix-h.api.efipay.com.br";

  return {
    env: parsed.EFI_ENV,
    baseUrl,
    clientId: parsed.EFI_CLIENT_ID,
    clientSecret: parsed.EFI_CLIENT_SECRET,
    p12: Buffer.from(parsed.EFI_CERT_P12_BASE64, "base64"),
    passphrase: parsed.EFI_CERT_P12_PASSPHRASE ?? "",
  };
}
