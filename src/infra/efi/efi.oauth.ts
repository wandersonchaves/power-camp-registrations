import axios, { type AxiosInstance } from "axios";
import fs from "node:fs";
import https from "node:https";

import { getEfiConfig } from "./efi.config";

type TokenCache = {
  token: string;
  expiresAtMs: number;
};

let cache: TokenCache | null = null;

function buildOAuthClient(): AxiosInstance {
  const cfg = getEfiConfig();

  const cert = fs.readFileSync(cfg.certPemPath);
  const key = fs.readFileSync(cfg.certKeyPemPath);

  const httpsAgent = new https.Agent({
    cert,
    key,
    passphrase: cfg.certPassphrase,
    keepAlive: true,
  });

  return axios.create({
    baseURL: cfg.baseUrl,
    httpsAgent,
    timeout: 30_000,
    headers: {
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
  });
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAtMs > now + 30_000) {
    return cache.token;
  }

  const cfg = getEfiConfig();
  const http = buildOAuthClient();

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(
    "base64",
  );

  const res = await http.post(
    "/oauth/token",
    { grant_type: "client_credentials" },
    { headers: { Authorization: `Basic ${basic}` } },
  );

  const token = String(res.data?.access_token ?? "");
  const expiresIn = Number(res.data?.expires_in ?? 0);
  const scope = String(res.data?.scope ?? "");

  if (process.env.NODE_ENV !== "production") {
    console.log("[EFI OAuth] scope:", scope);
  }

  cache = {
    token,
    expiresAtMs: now + expiresIn * 1000,
  };

  return token;
}
