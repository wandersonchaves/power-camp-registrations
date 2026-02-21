// src/infra/efi/webhooks/efi-webhook.client.ts
import { getEfiHttpClient } from "../efi.http";
import type {
  EfiWebhookConfigRequest,
  EfiWebhookConfigResponse,
} from "./efi-webhook.types";

function http() {
  return getEfiHttpClient();
}

export const efiWebhookClient = {
  webhookcobr: {
    async set(body: EfiWebhookConfigRequest): Promise<void> {
      await http().put("/v2/webhookcobr", body);
    },
    async get(): Promise<EfiWebhookConfigResponse> {
      const res = await http().get<EfiWebhookConfigResponse>("/v2/webhookcobr");
      return res.data;
    },
    async delete(): Promise<void> {
      await http().delete("/v2/webhookcobr");
    },
  },

  webhookrec: {
    async set(body: EfiWebhookConfigRequest): Promise<void> {
      await http().put("/v2/webhookrec", body);
    },
    async get(): Promise<EfiWebhookConfigResponse> {
      const res = await http().get<EfiWebhookConfigResponse>("/v2/webhookrec");
      return res.data;
    },
    async delete(): Promise<void> {
      await http().delete("/v2/webhookrec");
    },
  },
};
