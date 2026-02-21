// src/infra/efi/efi.http.ts
import axios, { type AxiosInstance } from "axios";
import fs from "node:fs";
import https from "node:https";

import { getEfiConfig } from "./efi.config";
import { getEfiAccessToken } from "./efi.oauth";

let httpSingleton: AxiosInstance | null = null;
let agentSingleton: https.Agent | null = null;

/**
 * ✅ Cria o Agent mTLS (PFX ou PEM) com keepAlive.
 * O getEfiConfig() já valida as envs e paths.
 */
export function getEfiHttpsAgent(): https.Agent {
  if (agentSingleton) return agentSingleton;

  const cfg = getEfiConfig();

  // ✅ Preferência: PFX (.p12/.pfx) em Buffer
  if (cfg.p12) {
    agentSingleton = new https.Agent({
      pfx: cfg.p12,
      passphrase: cfg.passphrase, // pode ser ""
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 30_000,
    });
    return agentSingleton;
  }

  // ✅ Fallback: PEM (local/legado)
  if (cfg.certPemPath && cfg.certKeyPemPath) {
    // getEfiConfig já valida existsSync, mas mantemos segurança extra
    const cert = fs.readFileSync(cfg.certPemPath);
    const key = fs.readFileSync(cfg.certKeyPemPath);

    agentSingleton = new https.Agent({
      cert,
      key,
      passphrase: cfg.certPassphrase, // pode ser ""
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 30_000,
    });
    return agentSingleton;
  }

  // ✅ erro com contexto (se chegar aqui, env/config está errado)
  throw new Error(
    [
      "EFI HTTPS cert missing.",
      "Forneça UMA opção válida:",
      '1) EFI_PFX_BASE64 + EFI_PASSPHRASE (pode ser vazio "")',
      '2) EFI_PFX_PATH + EFI_PASSPHRASE (pode ser vazio "")',
      "3) EFI_CERT_PEM_PATH + EFI_CERT_KEY_PEM_PATH (EFI_CERT_PASSPHRASE opcional)",
    ].join(" "),
  );
}

/**
 * ✅ Axios client Efí Pix (Pix Automático)
 * - baseURL: cfg.baseUrl
 * - mTLS obrigatório
 * - adiciona Bearer token automaticamente via interceptor
 */
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
      Accept: "application/json",
      // doc Efí recomenda gzip quando não precisa do Content-Length antes
      "Accept-Encoding": "gzip",
    },
  });

  // ✅ aplica Bearer token automaticamente (cache/dedupe no provider)
  http.interceptors.request.use(async (config) => {
    const token = await getEfiAccessToken();
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  httpSingleton = http;
  return http;
}
