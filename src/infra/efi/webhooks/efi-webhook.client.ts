import type {
  EfiWebhookConfigRequest,
  EfiWebhookConfigResponse,
} from "./efi-webhook.types";

import { getEfiHttpClient } from "@/infra/efi/efi.http";

export const efiWebhookClient = {
  webhookcobr: {
    async set(body: EfiWebhookConfigRequest): Promise<void> {
      const http = getEfiHttpClient();
      await http.put("/v2/webhookcobr", body);
    },
    async get(): Promise<EfiWebhookConfigResponse> {
      const http = getEfiHttpClient();
      const res = await http.get<EfiWebhookConfigResponse>("/v2/webhookcobr");
      return res.data;
    },
    async delete(): Promise<void> {
      const http = getEfiHttpClient();
      await http.delete("/v2/webhookcobr");
    },
  },

  webhookrec: {
    async set(body: EfiWebhookConfigRequest): Promise<void> {
      const http = getEfiHttpClient();
      await http.put("/v2/webhookrec", body);
    },
    async get(): Promise<EfiWebhookConfigResponse> {
      const http = getEfiHttpClient();
      const res = await http.get<EfiWebhookConfigResponse>("/v2/webhookrec");
      return res.data;
    },
    async delete(): Promise<void> {
      const http = getEfiHttpClient();
      await http.delete("/v2/webhookrec");
    },
  },
};
