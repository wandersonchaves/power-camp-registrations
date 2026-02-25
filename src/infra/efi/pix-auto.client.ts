// src/infra/efi/pix-auto.client.ts
import type { AxiosError } from "axios";

import { getEfiHttpClient } from "./efi.http";
import type {
  CobResponse,
  CobrResponse,
  CobStatus,
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

type EfiViolation = { razao: string; propriedade?: string };

type EfiProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  violacoes?: EfiViolation[] | string;
};

type LoggedAxiosMeta = {
  op: string;
  baseURL?: string;
  url?: string;
  method?: string;
  txid?: string;
  idRec?: string;
  idSolicRec?: string;
};

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
    log("error", "[EFI] request failed (non-axios)", meta);
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

/**
 * Helpers para detectar violações semânticas (BCB)
 */
function hasViolation(
  err: unknown,
  predicate: (v: EfiViolation) => boolean,
): boolean {
  if (!isAxiosError<EfiProblemDetails>(err)) return false;
  const violacoes = extractViolacoes(err.response?.data);
  return violacoes.some(predicate);
}

function lower(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function includesAll(hay: string, parts: string[]) {
  return parts.every((p) => hay.includes(p));
}

function tryExtractTxidFromRecBody(body: CreateRecRequest): string | undefined {
  const txid = (
    body as unknown as { ativacao?: { dadosJornada?: { txid?: unknown } } }
  )?.ativacao?.dadosJornada?.txid;
  const s = String(txid ?? "").trim();
  return s ? s : undefined;
}

function normalizeId(name: string, v: string) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`[EFI] ${name} vazio.`);
  return s;
}

type CacheEntry<T> = { value: T; expiresAt: number };
const cobCache = new Map<string, CacheEntry<CobResponse>>();

function isTerminalNotUsableCobStatus(status?: CobStatus | string) {
  const s = String(status ?? "").toUpperCase();
  return (
    s === "CONCLUIDA" ||
    s === "EXPIRADA" ||
    s === "CANCELADA" ||
    s === "REMOVIDA_PELO_USUARIO_RECEBEDOR" ||
    s === "REMOVIDA_PELO_PSP"
  );
}

export const pixAutoClient = {
  locrec: {
    async create(body: CreateLocRecRequest = {}): Promise<LocRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<LocRecResponse>("/v2/locrec", body);
      return res.data;
    },
  },

  cob: {
    async create(body: CreateCobRequest): Promise<CobResponse> {
      const http = getEfiHttpClient();
      try {
        const res = await http.post<CobResponse>("/v2/cob", body);
        if (res.data?.txid) assertValidTxid(res.data.txid);
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "POST /v2/cob",
          baseURL: http.defaults.baseURL,
          url: "/v2/cob",
          method: "POST",
        });
        throw err;
      }
    },

    async get(txid: string): Promise<CobResponse> {
      const safeTxid = String(txid ?? "").trim();
      assertValidTxid(safeTxid);

      const http = getEfiHttpClient();
      try {
        const res = await http.get<CobResponse>(
          `/v2/cob/${encodeURIComponent(safeTxid)}`,
        );
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "GET /v2/cob/:txid",
          baseURL: http.defaults.baseURL,
          url: `/v2/cob/${safeTxid}`,
          method: "GET",
          txid: safeTxid,
        });
        throw err;
      }
    },

    async getCached(
      txid: string,
      opts?: { dedupeTtlMs?: number },
    ): Promise<CobResponse> {
      const safeTxid = String(txid ?? "").trim();
      assertValidTxid(safeTxid);

      const ttl = opts?.dedupeTtlMs ?? 1500;
      const now = Date.now();
      const hit = cobCache.get(safeTxid);
      if (hit && hit.expiresAt > now) return hit.value;

      const value = await this.get(safeTxid);
      cobCache.set(safeTxid, { value, expiresAt: now + ttl });
      return value;
    },

    /**
     * ✅ Status terminal e NÃO usável para ativação da Jornada 3.
     * /v2/rec exige txid ATIVA quando usado em ativacao.dadosJornada.txid
     */
    isTerminalNotUsableStatus(
      status: import("./pix-auto.types").CobStatus | unknown,
    ): boolean {
      const s = String(status ?? "")
        .toUpperCase()
        .trim();

      return (
        s === "CONCLUIDA" ||
        s === "EXPIRADA" ||
        s === "CANCELADA" ||
        s === "REMOVIDA_PELO_USUARIO_RECEBEDOR" ||
        s === "REMOVIDA_PELO_PSP"
      );
    },

    /**
     * ✅ Único status considerado usável para ativação na Jornada 3.
     */
    isUsableForJourney3Activation(
      status: import("./pix-auto.types").CobStatus | unknown,
    ): boolean {
      const s = String(status ?? "")
        .toUpperCase()
        .trim();
      return s === "ATIVA";
    },

    isNotActive(
      status: import("./pix-auto.types").CobStatus | unknown,
    ): boolean {
      const s = String(status ?? "")
        .toUpperCase()
        .trim();
      return s !== "ATIVA";
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
          method: "POST",
          txid: tryExtractTxidFromRecBody(body),
        });
        throw err;
      }
    },

    async get(idRec: string, opts?: { txid?: string }): Promise<RecResponse> {
      const safeIdRec = normalizeId("idRec", idRec);

      const txid = opts?.txid ? String(opts.txid).trim() : "";
      if (txid) assertValidTxid(txid);

      const http = getEfiHttpClient();
      try {
        const res = await http.get<RecResponse>(
          `/v2/rec/${encodeURIComponent(safeIdRec)}`,
          { params: txid ? { txid } : undefined },
        );
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "GET /v2/rec/:idRec",
          baseURL: http.defaults.baseURL,
          url: `/v2/rec/${safeIdRec}`,
          method: "GET",
          idRec: safeIdRec,
          txid: txid || undefined,
        });
        throw err;
      }
    },
  },

  // ✅ ADIÇÃO: COBR (Pix Automático - cobrança associada à recorrência)
  cobr: {
    async create(body: CreateCobrRequest): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      try {
        const res = await http.post<CobrResponse>("/v2/cobr", body);
        if (res.data?.txid) assertValidTxid(res.data.txid);
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "POST /v2/cobr",
          baseURL: http.defaults.baseURL,
          url: "/v2/cobr",
          method: "POST",
        });
        throw err;
      }
    },

    async put(txid: string, body: CreateCobrRequest): Promise<CobrResponse> {
      const safeTxid = String(txid ?? "").trim();
      assertValidTxid(safeTxid);

      const http = getEfiHttpClient();
      try {
        const res = await http.put<CobrResponse>(
          `/v2/cobr/${encodeURIComponent(safeTxid)}`,
          body,
        );
        if (res.data?.txid) assertValidTxid(res.data.txid);
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "PUT /v2/cobr/:txid",
          baseURL: http.defaults.baseURL,
          url: `/v2/cobr/${safeTxid}`,
          method: "PUT",
          txid: safeTxid,
        });
        throw err;
      }
    },

    async get(txid: string): Promise<CobrResponse> {
      const safeTxid = String(txid ?? "").trim();
      assertValidTxid(safeTxid);

      const http = getEfiHttpClient();
      try {
        const res = await http.get<CobrResponse>(
          `/v2/cobr/${encodeURIComponent(safeTxid)}`,
        );
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "GET /v2/cobr/:txid",
          baseURL: http.defaults.baseURL,
          url: `/v2/cobr/${safeTxid}`,
          method: "GET",
          txid: safeTxid,
        });
        throw err;
      }
    },

    async patch(txid: string, body: PatchCobrRequest): Promise<CobrResponse> {
      const safeTxid = String(txid ?? "").trim();
      assertValidTxid(safeTxid);

      const http = getEfiHttpClient();
      try {
        const res = await http.patch<CobrResponse>(
          `/v2/cobr/${encodeURIComponent(safeTxid)}`,
          body,
        );
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "PATCH /v2/cobr/:txid",
          baseURL: http.defaults.baseURL,
          url: `/v2/cobr/${safeTxid}`,
          method: "PATCH",
          txid: safeTxid,
        });
        throw err;
      }
    },
  },

  // ✅ ADIÇÃO: SOLICREC (solicitação de confirmação da recorrência)
  solicrec: {
    async create(body: CreateSolicRecRequest): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      try {
        const res = await http.post<SolicRecResponse>("/v2/solicrec", body);
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "POST /v2/solicrec",
          baseURL: http.defaults.baseURL,
          url: "/v2/solicrec",
          method: "POST",
          idRec: normalizeId("idRec", body.idRec),
        });
        throw err;
      }
    },

    async get(idSolicRec: string): Promise<SolicRecResponse> {
      const safe = normalizeId("idSolicRec", idSolicRec);
      const http = getEfiHttpClient();
      try {
        const res = await http.get<SolicRecResponse>(
          `/v2/solicrec/${encodeURIComponent(safe)}`,
        );
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "GET /v2/solicrec/:idSolicRec",
          baseURL: http.defaults.baseURL,
          url: `/v2/solicrec/${safe}`,
          method: "GET",
          idSolicRec: safe,
        });
        throw err;
      }
    },

    async patch(
      idSolicRec: string,
      body: Partial<CreateSolicRecRequest>,
    ): Promise<SolicRecResponse> {
      const safe = normalizeId("idSolicRec", idSolicRec);
      const http = getEfiHttpClient();
      try {
        const res = await http.patch<SolicRecResponse>(
          `/v2/solicrec/${encodeURIComponent(safe)}`,
          body,
        );
        return res.data;
      } catch (err) {
        logAxiosError(err, {
          op: "PATCH /v2/solicrec/:idSolicRec",
          baseURL: http.defaults.baseURL,
          url: `/v2/solicrec/${safe}`,
          method: "PATCH",
          idSolicRec: safe,
        });
        throw err;
      }
    },
  },

  errors: {
    /**
     * “A cobrança referenciada por rec.ativacao.dadosJornada.txid não está ativa.”
     */
    isRecActivationTxidNotActive(err: unknown): boolean {
      return hasViolation(err, (v) => {
        const p = lower(v.propriedade);
        const r = lower(v.razao);

        const propertyOk =
          p.includes("body.rec.ativacao.dadosjornada.txid") ||
          p.includes("rec.ativacao.dadosjornada.txid");

        const reasonOk =
          r.includes("não está ativa") ||
          r.includes("nao esta ativa") ||
          includesAll(r, ["txid", "ativa", "não"]) ||
          includesAll(r, ["txid", "ativa", "nao"]);

        return propertyOk && reasonOk;
      });
    },

    /**
     * locrec reutilizado
     */
    isRecLocAlreadyUsed(err: unknown): boolean {
      return hasViolation(err, (v) => {
        const p = lower(v.propriedade);
        const r = lower(v.razao);

        const propertyOk = p.includes("body.rec.loc") || p.includes("rec.loc");
        const reasonOk =
          r.includes("location") ||
          r.includes("loc") ||
          r.includes("utiliz") ||
          r.includes("usado") ||
          r.includes("utilizado");

        return propertyOk && reasonOk;
      });
    },

    /**
     * Contrato já tem recorrência ativa
     */
    isContratoAlreadyHasActiveRecurrence(err: unknown): boolean {
      return hasViolation(err, (v) => {
        const r = lower(v.razao);
        return (
          r.includes("contrato") && r.includes("recorr") && r.includes("ativa")
        );
      });
    },

    /**
     * txid expirada (heurístico)
     */
    isRecTxidExpired(err: unknown): boolean {
      return hasViolation(err, (v) => {
        const r = lower(v.razao);
        const p = lower(v.propriedade);
        return (
          (p.includes("txid") || r.includes("txid")) && r.includes("expir")
        );
      });
    },

    /**
     * ✅ 500/Erro interno do servidor (BCB/Efí)
     */
    isRecInternalServerError(err: unknown): boolean {
      if (!isAxiosError(err)) return false;
      return (err.response?.status ?? 0) >= 500;
    },

    /**
     * ✅ namespace de validações relacionadas a COB
     */
    cob: {
      isTerminalNotUsableStatus: isTerminalNotUsableCobStatus,

      /**
       * Status que é aceitável para ativação no /rec (o mais seguro)
       */
      isUsableForJourney3Activation(status: unknown): boolean {
        const s = String(status ?? "")
          .toUpperCase()
          .trim();
        return s === "ATIVA";
      },
    },
  },
};
