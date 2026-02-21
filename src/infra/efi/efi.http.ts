import axios, { type AxiosInstance } from "axios";
import fs from "node:fs";
import https from "node:https";

import { getEfiConfig } from "./efi.config";
import { getAccessToken } from "./efi.oauth";

let httpSingleton: AxiosInstance | null = null;

export function getEfiHttpClient(): AxiosInstance {
  if (httpSingleton) return httpSingleton;

  const cfg = getEfiConfig();

  const cert = fs.readFileSync(cfg.certPemPath);
  const key = fs.readFileSync(cfg.certKeyPemPath);

  const httpsAgent = new https.Agent({
    cert,
    key,
    passphrase: cfg.certPassphrase,
    keepAlive: true,
  });

  const http = axios.create({
    baseURL: cfg.baseUrl,
    httpsAgent,
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
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
