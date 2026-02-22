// src/infra/efi/pix-auto.client.ts
import type { AxiosError } from "axios";

import { getEfiHttpClient } from "./efi.http";
import type {
  CobResponse,
  CobrResponse,
  CreateCobRequest,
  CreateCobrRequest,
  CreateLocRecRequest,
  CreateRecRequest,
  CreateSolicRecRequest,
  LocRecResponse,
  PatchCobrRequest,
  RecResponse,
  SolicRecResponse,
} from "./pix-auto.types";
import { assertValidTxid } from "./txid";

import { log } from "@/lib/logger";

type EfiCobNotFoundPayload = {
  nome?: string;
  mensagem?: string;
};

type EfiViolation = {
  razao: string;
  propriedade?: string;
};

type EfiProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  violacoes?: EfiViolation[] | string;
};

type LoggedAxiosMeta = {
  op: string;
  txid?: string;
  baseURL?: string;
  url?: string;
};

function assertEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} não definida no ambiente.`);
  return v;
}

function normalizeMoney(value: string): string {
  const raw = String(value).trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Valor inválido.");
  return n.toFixed(2);
}

function isAxiosError<T>(err: unknown): err is AxiosError<T> {
  return typeof err === "object" && err !== null && "isAxiosError" in err;
}

function extractViolacoes(data: unknown): EfiViolation[] {
  if (!data || typeof data !== "object") return [];
  const d = data as { violacoes?: unknown };

  if (!d.violacoes) return [];

  if (Array.isArray(d.violacoes)) {
    return d.violacoes
      .filter((v) => v && typeof v === "object")
      .map((v) => {
        const vv = v as { razao?: unknown; propriedade?: unknown };
        return {
          razao: String(vv.razao ?? ""),
          propriedade:
            vv.propriedade !== undefined ? String(vv.propriedade) : undefined,
        };
      })
      .filter((v) => v.razao.length > 0);
  }

  if (typeof d.violacoes === "string") {
    try {
      const parsed = JSON.parse(d.violacoes) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v) => v && typeof v === "object")
          .map((v) => {
            const vv = v as { razao?: unknown; propriedade?: unknown };
            return {
              razao: String(vv.razao ?? ""),
              propriedade:
                vv.propriedade !== undefined
                  ? String(vv.propriedade)
                  : undefined,
            };
          })
          .filter((v) => v.razao.length > 0);
      }
    } catch {
      return [];
    }
  }

  return [];
}

function logAxiosError(err: unknown, meta: LoggedAxiosMeta) {
  if (!isAxiosError(err)) {
    log("error", "[EFI] request failed (non-axios)", { ...meta });
    return;
  }

  const status = err.response?.status;
  const data = err.response?.data;

  log("error", "[EFI] request failed", {
    ...meta,
    status,
    data,
    violacoes: extractViolacoes(data),
  });
}

function isCobNotFoundError(err: unknown): boolean {
  if (!isAxiosError<EfiCobNotFoundPayload>(err)) return false;
  const status = err.response?.status;
  const data = err.response?.data;

  return (
    status === 400 &&
    typeof data === "object" &&
    data !== null &&
    String((data as EfiCobNotFoundPayload).nome ?? "") ===
      "cobranca_nao_encontrada"
  );
}

// ✅ helper novo (coloque perto dos outros helpers)
function isRecQueryTxidExpired(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  const data = err.response?.data as { violacoes?: unknown } | undefined;
  const violacoes = extractViolacoes(data);
  return violacoes.some(
    (v) =>
      (v.propriedade ?? "").toLowerCase().includes("query.txid") &&
      v.razao.toLowerCase().includes("expir"),
  );
}

export type Journey3CobImmediateParams = Readonly<{
  txid: string;
  valor: string;
  solicitacaoPagador?: string;
  // opcional: se quiser mandar devedor na COB imediata
  devedor?: { cpf: string; nome: string };
}>;

export const pixAutoClient = {
  locrec: {
    async create(body: CreateLocRecRequest = {}): Promise<LocRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<LocRecResponse>("/v2/locrec", body);
      return res.data;
    },
  },

  cob: {
    // ✅ necessário para create-journey3.use-case.ts (POST /v2/cob)
    async create(body: CreateCobRequest): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<CobResponse>("/v2/cob", body);
      return res.data;
    },

    async put(txid: string, body: CreateCobRequest): Promise<CobResponse> {
      assertValidTxid(txid);
      const http = getEfiHttpClient();
      const res = await http.put<CobResponse>(
        `/v2/cob/${encodeURIComponent(txid)}`,
        body,
      );
      return res.data;
    },

    async get(txid: string): Promise<CobResponse> {
      assertValidTxid(txid);
      const http = getEfiHttpClient();
      const res = await http.get<CobResponse>(
        `/v2/cob/${encodeURIComponent(txid)}`,
      );
      return res.data;
    },

    async getOrNull(txid: string): Promise<CobResponse | null> {
      assertValidTxid(txid);
      const http = getEfiHttpClient();

      try {
        const res = await http.get<CobResponse>(
          `/v2/cob/${encodeURIComponent(txid)}`,
        );
        return res.data;
      } catch (err) {
        if (isCobNotFoundError(err)) return null;

        logAxiosError(err, {
          op: "GET /v2/cob/:txid",
          txid,
          baseURL: http.defaults.baseURL,
          url: `/v2/cob/${txid}`,
        });
        throw err;
      }
    },
  },

  journey3: {
    /**
     * ✅ Jornada 3:
     * - Preferimos PUT /v2/cob/:txid para idempotência real.
     * - NÃO enviamos "loc" na COB (deixa a Efí gerar loc).
     */
    async getOrCreateCobImmediate(
      params: Journey3CobImmediateParams,
    ): Promise<CobResponse> {
      const pixKey = assertEnv("EFI_PIX_KEY");
      const http = getEfiHttpClient();

      const existing = await pixAutoClient.cob.getOrNull(params.txid);
      if (existing) return existing;

      const body: CreateCobRequest = {
        calendario: { expiracao: 3600 },
        valor: { original: normalizeMoney(params.valor) },
        chave: pixKey,
        ...(params.devedor ? { devedor: params.devedor } : {}),
        ...(params.solicitacaoPagador
          ? { solicitacaoPagador: params.solicitacaoPagador }
          : {}),
      };

      try {
        return await pixAutoClient.cob.put(params.txid, body);
      } catch (err) {
        logAxiosError(err, {
          op: "PUT /v2/cob/:txid",
          txid: params.txid,
          baseURL: http.defaults.baseURL,
          url: `/v2/cob/${params.txid}`,
        });
        throw err;
      }
    },
  },

  rec: {
    async create(body: CreateRecRequest): Promise<RecResponse> {
      const http = getEfiHttpClient();
      try {
        const res = await http.post<RecResponse>("/v2/rec", body);
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "POST /v2/rec",
          baseURL: http.defaults.baseURL,
          url: "/v2/rec",
        });
        throw err;
      }
    },

    async get(idRec: string, opts?: { txid?: string }): Promise<RecResponse> {
      const safeIdRec = String(idRec ?? "").trim();
      if (!safeIdRec) {
        throw new Error("[EFI] idRec vazio ao consultar /v2/rec/:idRec.");
      }

      const txid = opts?.txid ? String(opts.txid).trim() : "";
      const http = getEfiHttpClient();

      try {
        const res = await http.get<RecResponse>(
          `/v2/rec/${encodeURIComponent(safeIdRec)}`,
          { params: txid ? { txid } : undefined },
        );
        return res.data;
      } catch (err) {
        // ✅ Se a Efí disser que query.txid expirou, faz fallback automático:
        if (txid && isRecQueryTxidExpired(err)) {
          log("warn", "[EFI] rec.get txid expirado; retry sem txid", {
            idRec: safeIdRec,
            txid,
          });

          const res2 = await http.get<RecResponse>(
            `/v2/rec/${encodeURIComponent(safeIdRec)}`,
          );
          return res2.data;
        }

        logAxiosError(err, {
          op: "GET /v2/rec/:idRec",
          baseURL: http.defaults.baseURL,
          url: `/v2/rec/${safeIdRec}`,
        });
        throw err;
      }
    },
  },

  cobr: {
    async create(body: CreateCobrRequest): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<CobrResponse>("/v2/cobr", body);
      return res.data;
    },

    async put(txid: string, body: CreateCobrRequest): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.put<CobrResponse>(
        `/v2/cobr/${encodeURIComponent(txid)}`,
        body,
      );
      return res.data;
    },

    async patch(txid: string, body: PatchCobrRequest): Promise<CobrResponse> {
      assertValidTxid(txid);
      const http = getEfiHttpClient();

      try {
        const res = await http.patch<CobrResponse>(
          `/v2/cobr/${encodeURIComponent(txid)}`,
          body,
        );
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "PATCH /v2/cobr/:txid",
          txid,
          baseURL: http.defaults.baseURL,
          url: `/v2/cobr/${txid}`,
        });
        throw err;
      }
    },
  },

  solicrec: {
    async create(body: CreateSolicRecRequest): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<SolicRecResponse>("/v2/solicrec", body);
      return res.data;
    },
  },

  errors: {
    /**
     * ✅ detecta erro semântico da EFI:
     * "A cobrança referenciada por rec.ativacao.dadosJornada.txid está expirada."
     */
    isRecTxidExpired(err: unknown): boolean {
      if (!isAxiosError<EfiProblemDetails>(err)) return false;
      const violacoes = extractViolacoes(err.response?.data);

      return violacoes.some((v) => {
        const r = v.razao.toLowerCase();
        return r.includes("txid") && r.includes("expir");
      });
    },

    /**
     * ✅ detecta erro semântico da EFI:
     * "O campo rec.vinculo.contrato informa um contrato que já tem recorrência ativa."
     */
    isContratoAlreadyHasActiveRecurrence(err: unknown): boolean {
      if (!isAxiosError<EfiProblemDetails>(err)) return false;
      const violacoes = extractViolacoes(err.response?.data);

      return violacoes.some((v) => {
        const r = v.razao.toLowerCase();
        return (
          r.includes("contrato") && r.includes("recorr") && r.includes("ativa")
        );
      });
    },

    isRecLocAlreadyUsed(err: unknown): boolean {
      if (!isAxiosError<EfiProblemDetails>(err)) return false;
      const data = err.response?.data;
      const violacoes = extractViolacoes(data);

      return violacoes.some((v) => {
        const r = v.razao.toLowerCase();
        const p = (v.propriedade ?? "").toLowerCase();
        return (
          (p.includes("body.rec.loc") || p.includes("rec.loc")) &&
          (r.includes("location") || r.includes("loc")) &&
          (r.includes("utiliz") ||
            r.includes("usado") ||
            r.includes("utilizado"))
        );
      });
    },
  },
};
