// src/infra/efi/efi.token-provider.ts
import https from "https";
import axios from "axios";

import { getEfiConfig } from "./efi.config";

import { AppError } from "@/lib/http-errors";
import { log } from "@/lib/logger";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
  scope?: string;
};

let tokenCache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now())
    return tokenCache.accessToken;

  const cfg = getEfiConfig();

  const agent = new https.Agent({
    pfx: cfg.p12,
    passphrase: cfg.passphrase,
    keepAlive: true,
  });

  const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(
    "base64",
  );

  try {
    const res = await axios.post(
      `${cfg.baseUrl}/oauth/token`,
      { grant_type: "client_credentials" },
      {
        httpsAgent: agent,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 15_000,
      },
    );

    const accessToken = res.data?.access_token as string | undefined;
    const expiresIn = (res.data?.expires_in as number | undefined) ?? 3600;

    if (!accessToken) {
      throw new AppError(
        "EFI OAuth token missing in response",
        502,
        "EFI_OAUTH_INVALID_RESPONSE",
        res.data,
      );
    }

    tokenCache = {
      accessToken,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
      scope: res.data?.scope as string | undefined,
    };

    log("info", "EFI token refreshed", { expiresIn });

    return accessToken;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const data = err.response?.data;
      log("error", "EFI token request failed", { status, data });
      throw new AppError(
        "Failed to authorize with EFI",
        502,
        "EFI_OAUTH_FAILED",
        { status, data },
      );
    }

    log("error", "EFI token request failed (non-axios error)");
    throw new AppError(
      "Failed to authorize with EFI",
      502,
      "EFI_OAUTH_FAILED",
      { err },
    );
  }
}
