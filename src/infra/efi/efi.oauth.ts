import axios from "axios";

import { getEfiConfig } from "./efi.config";
import { getEfiHttpsAgent } from "./efi.mtls";

type TokenCache = {
  token: string;
  expiresAtMs: number;
  scope?: string;
};

let cache: TokenCache | null = null;
let inflight: Promise<string> | null = null;

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function getEfiAccessToken(): Promise<string> {
  const now = Date.now();

  // margem de segurança (60s)
  if (cache && cache.expiresAtMs > now + 60_000) return cache.token;
  if (inflight) return inflight;

  inflight = (async () => {
    const cfg = getEfiConfig();
    const httpsAgent = getEfiHttpsAgent();
    const auth = basicAuth(cfg.clientId, cfg.clientSecret);

    try {
      const res = await axios.post(
        `${cfg.baseUrl}/oauth/token`,
        { grant_type: "client_credentials" },
        {
          httpsAgent,
          timeout: cfg.timeoutMs,
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Encoding": cfg.acceptEncoding,
          },
        },
      );

      const token =
        typeof res.data?.access_token === "string" ? res.data.access_token : "";
      const expiresInRaw = res.data?.expires_in;
      const expiresIn =
        typeof expiresInRaw === "number"
          ? expiresInRaw
          : Number(expiresInRaw ?? 0);

      const scope =
        typeof res.data?.scope === "string" ? res.data.scope : undefined;

      if (!token) {
        throw new Error("EFI OAuth retornou resposta sem access_token.");
      }

      // se vier algo bizarro, cai pra 3600
      const expiresSec =
        Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;

      // margem: evita expirar em request no meio
      const safeExpiresSec = Math.max(60, expiresSec - 90);

      cache = {
        token,
        expiresAtMs: now + safeExpiresSec * 1000,
        scope,
      };

      return token;
    } catch (err: unknown) {
      cache = null;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data;

        // ⚠️ nunca logue client_secret/cert. Aqui só devolvemos payload do servidor.
        const details =
          typeof data === "string"
            ? data
            : data && typeof data === "object"
              ? JSON.stringify(data)
              : String(data ?? "");

        throw new Error(
          `EFI OAuth falhou (status=${status ?? "?"}). ${details}`.trim(),
        );
      }

      throw err instanceof Error ? err : new Error("EFI OAuth falhou.");
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
