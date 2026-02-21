import axios, { type AxiosInstance } from "axios";
import fs from "node:fs";
import https from "node:https";

import { getEfiConfig } from "./efi.config";
import { getAccessToken } from "./efi.token-provider";

let httpSingleton: AxiosInstance | null = null;
let agentSingleton: https.Agent | null = null;

function readBase64Maybe(data: string): Buffer {
  // aceita puro base64 ou data URL "data:application/x-pkcs12;base64,..."
  const raw = data.includes("base64,")
    ? (data.split("base64,").pop() ?? "")
    : data;
  return Buffer.from(raw, "base64");
}

export function getEfiHttpsAgent(): https.Agent {
  if (agentSingleton) return agentSingleton;

  const cfg = getEfiConfig();

  // Preferência: PFX base64 (Railway) -> PFX path -> PEM cert/key
  if (cfg.pfxBase64) {
    const pfx = readBase64Maybe(cfg.pfxBase64);
    agentSingleton = new https.Agent({
      pfx,
      passphrase: cfg.passphrase,
      keepAlive: true,
    });
    return agentSingleton;
  }

  if (cfg.pfxPath) {
    const pfx = fs.readFileSync(cfg.pfxPath);
    agentSingleton = new https.Agent({
      pfx,
      passphrase: cfg.passphrase,
      keepAlive: true,
    });
    return agentSingleton;
  }

  // fallback (dev / legado): PEM
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
    "EFI HTTPS cert missing. Provide pfxBase64 or pfxPath or (certPemPath + certKeyPemPath).",
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

  http.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  httpSingleton = http;
  return http;
}
