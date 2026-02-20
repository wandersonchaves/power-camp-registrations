import https from "https";
import axios, { AxiosInstance } from "axios";

import { getEfiConfig } from "./efi.config";
import { getAccessToken } from "./efi.token-provider";

let client: AxiosInstance | null = null;

export function getEfiHttpClient(): AxiosInstance {
  if (client) return client;

  const cfg = getEfiConfig();

  const httpsAgent = new https.Agent({
    pfx: cfg.p12,
    passphrase: cfg.passphrase,
    keepAlive: true,
    maxSockets: 50,
  });

  const instance = axios.create({
    baseURL: cfg.baseUrl,
    timeout: 20_000,
    httpsAgent,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  instance.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client = instance;
  return instance;
}
