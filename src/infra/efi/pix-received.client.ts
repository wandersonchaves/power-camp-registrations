// src/infra/efi/pix-received.client.ts
// Somente leitura: GET /v2/pix (escopo pix.read). Nunca chama endpoints que movimentam dinheiro.
import type { AxiosInstance } from "axios";

import { getEfiHttpClient } from "./efi.http";
import { mapEfiPixItem } from "./pix-received.mapper";

import type {
  CobPayerLookup,
  ReceivedPixItem,
  ReceivedPixPage,
  ReceivedPixSource,
} from "@/use-cases/team-installments/ports";

const PAGE_SIZE = 100;

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 5,
  baseDelayMs: 500,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
};

function statusOf(err: unknown): number | null {
  const status = (err as { response?: { status?: unknown } })?.response?.status;
  return typeof status === "number" ? status : null;
}

function retryAfterMs(err: unknown): number | null {
  const header = (err as { response?: { headers?: Record<string, unknown> } })
    ?.response?.headers?.["retry-after"];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

/** 429, 5xx e falhas de rede (sem resposta) são transitórias; 4xx restantes não. */
function isRetryable(err: unknown) {
  const status = statusOf(err);
  return status === null || status === 429 || status >= 500;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const o = { ...DEFAULT_RETRY, ...options };
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= o.maxAttempts || !isRetryable(err)) throw err;
      const backoff = o.baseDelayMs * 2 ** (attempt - 1) * (0.5 + o.random());
      await o.sleep(Math.max(backoff, retryAfterMs(err) ?? 0));
    }
  }
}

const E2E_ID = /^E[0-9A-Za-z]{10,40}$/;

export class EfiPixReceivedClient implements ReceivedPixSource {
  constructor(
    private readonly http: () => AxiosInstance = getEfiHttpClient,
    private readonly retry: Partial<RetryOptions> = {},
  ) {}

  async fetchByEndToEndId(endToEndId: string): Promise<ReceivedPixItem | null> {
    // Valida antes de montar a URL (nada de caminhos arbitrários).
    if (!E2E_ID.test(endToEndId)) return null;

    try {
      const { data } = await withRetry(
        () => this.http().get(`/v2/pix/${endToEndId}`),
        this.retry,
      );
      return mapEfiPixItem(data);
    } catch (err) {
      if (statusOf(err) === 404) return null;
      throw err;
    }
  }

  async fetchPage(range: {
    from: Date;
    to: Date;
    page: number;
  }): Promise<ReceivedPixPage> {
    const { data } = await withRetry(
      () =>
        this.http().get("/v2/pix", {
          params: {
            inicio: range.from.toISOString(),
            fim: range.to.toISOString(),
            "paginacao.paginaAtual": range.page,
            "paginacao.itensPorPagina": PAGE_SIZE,
          },
        }),
      this.retry,
    );

    const rawItems: unknown[] = Array.isArray(data?.pix) ? data.pix : [];
    const totalPages = Number(data?.parametros?.paginacao?.quantidadeDePaginas);

    return {
      items: rawItems.flatMap((raw) => {
        const pix = mapEfiPixItem(raw);
        return pix ? [pix] : [];
      }),
      totalPages:
        Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
    };
  }
}

/** Devedor da cobrança (GET /v2/cob/{txid}, somente leitura) como "responsável" pelo Pix. */
export class EfiCobPayerLookup implements CobPayerLookup {
  constructor(
    private readonly getCob: (txid: string) => Promise<{
      devedor?: { nome?: string; cpf?: string; cnpj?: string };
    }>,
  ) {}

  async findPayer(txid: string) {
    try {
      const cob = await this.getCob(txid);
      const devedor = cob.devedor;
      if (!devedor) return null;
      return {
        name: devedor.nome?.trim() || null,
        document: devedor.cpf || devedor.cnpj || null,
      };
    } catch {
      return null; // enriquecimento é opcional: nunca derruba a busca
    }
  }
}
