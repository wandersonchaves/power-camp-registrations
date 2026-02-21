import axios, { type AxiosInstance } from "axios";
import fs from "node:fs";
import https from "node:https";

import { getEfiConfig } from "./efi.config";
import { getAccessToken } from "./efi.token-provider";

let httpSingleton: AxiosInstance | null = null;
let agentSingleton: https.Agent | null = null;

export function getEfiHttpsAgent(): https.Agent {
  if (agentSingleton) return agentSingleton;

  const cfg = getEfiConfig();

  // ✅ Preferência: PFX já resolvido em Buffer (Railway/local)
  if (cfg.p12) {
    agentSingleton = new https.Agent({
      pfx: cfg.p12,
      passphrase: cfg.passphrase,
      keepAlive: true,
    });
    return agentSingleton;
  }

  // ✅ fallback (dev/legado): PEM
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
    "EFI HTTPS cert missing. Provide PFX (EFI_PFX_BASE64/EFI_PFX_PATH) or PEM pair (EFI_CERT_PEM_PATH + EFI_CERT_KEY_PEM_PATH).",
  );
}

export function getEfiHttpClient(): AxiosInstance {
  if (httpSingleton) return httpSingleton;

  const cfg = getEfiConfig();
  const httpsAgent = getEfiHttpsAgent();

  const http = axios.create({
    baseURL: cfg.baseUrl,
    httpsAgent,
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
      Accept: "application/json",
    },
  });

  // ✅ aplica Bearer token automaticamente (cache do token fica no provider)
  http.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  httpSingleton = http;
  return http;
}
