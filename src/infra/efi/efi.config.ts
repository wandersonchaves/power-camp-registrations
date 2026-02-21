export type EfiEnv = "prod" | "homolog";

export type EfiConfig = {
  env: EfiEnv;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  certPemPath: string;
  certKeyPemPath: string;
  certPassphrase: string | undefined;

  recebedor?: {
    agencia?: string;
    conta: string;
    tipoConta: "CORRENTE" | "POUPANCA" | "PAGAMENTO";
  };
};

export function getEfiConfig(): EfiConfig {
  const env = (process.env.EFI_PIX_ENV ?? "homolog") as EfiEnv;

  const baseUrl =
    env === "prod"
      ? "https://pix.api.efipay.com.br"
      : "https://pix-h.api.efipay.com.br";

  const clientId = process.env.EFI_CLIENT_ID ?? "";
  const clientSecret = process.env.EFI_CLIENT_SECRET ?? "";
  const certPemPath = process.env.EFI_CERT_PEM_PATH ?? "";
  const certKeyPemPath = process.env.EFI_CERT_KEY_PEM_PATH ?? "";
  const certPassphrase = (process.env.EFI_CERT_PASSPHRASE ?? "") || undefined;

  if (!clientId || !clientSecret || !certPemPath || !certKeyPemPath) {
    throw new Error(
      [
        "EFI config incompleta.",
        "Verifique:",
        "- EFI_CLIENT_ID",
        "- EFI_CLIENT_SECRET",
        "- EFI_CERT_PEM_PATH",
        "- EFI_CERT_KEY_PEM_PATH",
        "Dica: use .env.local e reinicie o servidor.",
      ].join("\n"),
    );
  }

  const recebedorConta = process.env.EFI_RECEBEDOR_CONTA ?? "";
  const recebedorTipoConta = (process.env.EFI_RECEBEDOR_TIPO_CONTA ?? "") as
    | "CORRENTE"
    | "POUPANCA"
    | "PAGAMENTO"
    | "";

  const recebedor =
    recebedorConta && recebedorTipoConta
      ? {
          agencia: (process.env.EFI_RECEBEDOR_AGENCIA ?? "") || undefined,
          conta: recebedorConta,
          tipoConta: recebedorTipoConta,
        }
      : undefined;

  return {
    env,
    baseUrl,
    clientId,
    clientSecret,
    certPemPath,
    certKeyPemPath,
    certPassphrase,
    recebedor,
  };
}
