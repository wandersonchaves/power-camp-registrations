// src/infra/efi/efi.oauth.ts
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

/**
 * Defaults de rede para OAuth.
 * Mantemos aqui (em vez de cfg.timeoutMs) para não acoplar o config
 * e evitar quebrar o tipo no build.
 */
const OAUTH_TIMEOUT_MS = 15_000;
const OAUTH_ACCEPT_ENCODING = "gzip";

export async function getEfiAccessToken(): Promise<string> {
  const now = Date.now();

  // ✅ margem de segurança (60s)
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
          timeout: OAUTH_TIMEOUT_MS,
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Encoding": OAUTH_ACCEPT_ENCODING,
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

      // ✅ se vier algo bizarro, cai pra 3600
      const expiresSec =
        Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600;

      // ✅ margem: evita expirar no meio de uma request
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
