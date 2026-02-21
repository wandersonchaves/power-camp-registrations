import axios from "axios";

import { getEfiConfig } from "./efi.config";
import { getEfiHttpsAgent } from "./efi.http";

import { AppError } from "@/lib/http-errors";
import { log } from "@/lib/logger";

type TokenCache = {
  accessToken: string;
  expiresAt: number; // epoch ms
  scope?: string;
};

let tokenCache: TokenCache | null = null;

// ✅ dedupe de requests concorrentes
let inflight: Promise<string> | null = null;

function basicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now())
    return tokenCache.accessToken;
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
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 15_000,
        },
      );

      const data = res.data as {
        access_token?: unknown;
        expires_in?: unknown;
        scope?: unknown;
      };

      if (typeof data.access_token !== "string" || !data.access_token) {
        throw new AppError(
          "EFI OAuth token missing in response",
          502,
          "EFI_OAUTH_INVALID_RESPONSE",
          res.data,
        );
      }

      const expiresSec =
        typeof data.expires_in === "number" && Number.isFinite(data.expires_in)
          ? data.expires_in
          : 3600;

      tokenCache = {
        accessToken: data.access_token,
        // ✅ margem 60s pra não expirar no meio de requests
        expiresAt: Date.now() + Math.max(60, expiresSec - 60) * 1000,
        scope: typeof data.scope === "string" ? data.scope : undefined,
      };

      log("info", "EFI token refreshed", { expiresIn: expiresSec });

      return tokenCache.accessToken;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const payload = err.response?.data;
        log("error", "EFI token request failed", { status, payload });

        throw new AppError(
          "Failed to authorize with EFI",
          502,
          "EFI_OAUTH_FAILED",
          {
            status,
            payload,
          },
        );
      }

      log("error", "EFI token request failed (non-axios error)");
      throw new AppError(
        "Failed to authorize with EFI",
        502,
        "EFI_OAUTH_FAILED",
        {
          err: String(err),
        },
      );
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
