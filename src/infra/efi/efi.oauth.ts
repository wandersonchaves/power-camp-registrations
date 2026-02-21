// src/infra/efi/efi.oauth.ts
import axios, { type AxiosInstance } from "axios";
import fs from "node:fs";
import https from "node:https";

import { getEfiConfig } from "./efi.config";

type TokenCache = {
  token: string;
  expiresAtMs: number;
  scope?: string;
};

let cache: TokenCache | null = null;
let inflight: Promise<string> | null = null;

let oauthHttpSingleton: AxiosInstance | null = null;
let agentSingleton: https.Agent | null = null;

function buildHttpsAgent(): https.Agent {
  if (agentSingleton) return agentSingleton;

  const cfg = getEfiConfig();

  // ✅ Preferência: PFX (.p12/.pfx) já carregado em memória (Railway/local)
  if (cfg.p12) {
    agentSingleton = new https.Agent({
      pfx: cfg.p12,
      passphrase: cfg.passphrase,
      keepAlive: true,
    });
    return agentSingleton;
  }

  // ✅ Fallback: PEM (legado/dev)
  if (cfg.certPemPath && cfg.certKeyPemPath) {
    const cert = fs.readFileSync(cfg.certPemPath);
    const key = fs.readFileSync(cfg.certKeyPemPath);

    agentSingleton = new https.Agent({
      cert,
      key,
      passphrase: cfg.certPassphrase,
      keepAlive: true,
    });
    return agentSingleton;
  }

  throw new Error(
    [
      "Certificado EFI não configurado para OAuth.",
      "Configure PFX via EFI_PFX_BASE64/EFI_PFX_PATH (recomendado) ou PEM via EFI_CERT_PEM_PATH + EFI_CERT_KEY_PEM_PATH.",
    ].join(" "),
  );
}

function buildOAuthClient(): AxiosInstance {
  if (oauthHttpSingleton) return oauthHttpSingleton;

  const cfg = getEfiConfig();
  const httpsAgent = buildHttpsAgent();

  oauthHttpSingleton = axios.create({
    baseURL: cfg.baseUrl,
    httpsAgent,
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
      Accept: "application/json",
    },
  });

  return oauthHttpSingleton;
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // ✅ cache com margem de segurança (30s)
  if (cache && cache.expiresAtMs > now + 30_000) return cache.token;

  // ✅ evita tempestade de token em concorrência (múltiplas requests)
  if (inflight) return inflight;

  inflight = (async () => {
    const cfg = getEfiConfig();
    const http = buildOAuthClient();

    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(
      "base64",
    );

    try {
      const res = await http.post(
        "/oauth/token",
        { grant_type: "client_credentials" },
        { headers: { Authorization: `Basic ${basic}` } },
      );

      const token =
        typeof res.data?.access_token === "string" ? res.data.access_token : "";
      const expiresInRaw = res.data?.expires_in;
      const expiresIn =
        typeof expiresInRaw === "number"
          ? expiresInRaw
          : Number(expiresInRaw ?? 0);

      const scope =
        typeof res.data?.scope === "string"
          ? (res.data.scope as string)
          : undefined;

      if (!token) {
        throw new Error("EFI OAuth retornou resposta sem access_token.");
      }

      // ✅ margem de 60s para evitar expirar durante chamadas
      const safeExpiresIn =
        Number.isFinite(expiresIn) && expiresIn > 120 ? expiresIn - 60 : 60;

      if (process.env.NODE_ENV !== "production" && scope) {
        // eslint-disable-next-line no-console
        console.log("[EFI OAuth] scope:", scope);
      }

      cache = {
        token,
        expiresAtMs: now + safeExpiresIn * 1000,
        scope,
      };

      return token;
    } catch (err: unknown) {
      // Se o token falhar, invalida cache pra forçar nova tentativa depois
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
