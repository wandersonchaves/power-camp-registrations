// src/infra/efi/pix-auto.client.ts
import type { AxiosError, AxiosInstance } from "axios";

import { getEfiHttpClient } from "./efi.http";
import type {
  CobListQuery,
  CobListResponse,
  CobResponse,
  CobrListQuery,
  CobrListResponse,
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

/**
 * ===== Types auxiliares (Problem Details do BCB/Efí) =====
 * Observação: em alguns casos o campo "violacoes" vem como string JSON.
 */
type EfiViolation = { razao: string; propriedade?: string };

type EfiProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  violacoes?: unknown; // array | string JSON | etc.
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

function isAxiosError<T = unknown>(err: unknown): err is AxiosError<T> {
  return typeof err === "object" && err !== null && "isAxiosError" in err;
}

function lower(v: unknown) {
  return String(v ?? "").toLowerCase();
}

function includesAll(hay: string, parts: string[]) {
  return parts.every((p) => hay.includes(p));
}

function normalizeId(name: string, v: string) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`[EFI] ${name} vazio.`);
  return s;
}

function normalizeTxid(txid: string) {
  const safeTxid = String(txid ?? "").trim();
  assertValidTxid(safeTxid);
  return safeTxid;
}

function extractViolacoes(data: unknown): EfiViolation[] {
  if (!data || typeof data !== "object") return [];
  const d = data as EfiProblemDetails;

  const raw = d.violacoes;
  if (!raw) return [];

  // 1) Já é array de objetos
  if (Array.isArray(raw)) {
    return raw
      .filter((v) => v && typeof v === "object")
      .map((v) => {
        const vv = v as { razao?: unknown; propriedade?: unknown };
        const razao = String(vv.razao ?? "").trim();
        const propriedade =
          vv.propriedade !== undefined
            ? String(vv.propriedade).trim()
            : undefined;
        return { razao, propriedade };
      })
      .filter((v) => v.razao.length > 0);
  }

  // 2) Algumas vezes vem como string JSON
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];

    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v) => v && typeof v === "object")
          .map((v) => {
            const vv = v as { razao?: unknown; propriedade?: unknown };
            const razao = String(vv.razao ?? "").trim();
            const propriedade =
              vv.propriedade !== undefined
                ? String(vv.propriedade).trim()
                : undefined;
            return { razao, propriedade };
          })
          .filter((v) => v.razao.length > 0);
      }
      return [];
    } catch {
      return [];
    }
  }

  return [];
}

function logAxiosError(err: unknown, meta: LoggedAxiosMeta) {
  if (!isAxiosError<EfiProblemDetails>(err)) {
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
 * Helper: detecta "violação semântica" no formato BCB/Efí.
 */
function hasViolation(
  err: unknown,
  predicate: (v: EfiViolation) => boolean,
): boolean {
  if (!isAxiosError<EfiProblemDetails>(err)) return false;
  const violacoes = extractViolacoes(err.response?.data);
  return violacoes.some(predicate);
}

/**
 * Wrapper de request: padroniza log de erro com meta.
 */
async function withAxiosLog<T>(
  http: AxiosInstance,
  meta: LoggedAxiosMeta,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logAxiosError(err, {
      ...meta,
      baseURL: http.defaults.baseURL,
    });
    throw err;
  }
}

/**
 * ===== Cache/Dedupe (GET /cob/:txid) =====
 * - Evita burst de GET em loops de retry/backoff.
 * - TTL curto por design.
 */
type CacheEntry<T> = { value: T; expiresAt: number };
const cobCache = new Map<string, CacheEntry<CobResponse>>();

function cacheGet<T>(m: Map<string, CacheEntry<T>>, k: string): T | null {
  const now = Date.now();
  const hit = m.get(k);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    m.delete(k);
    return null;
  }
  return hit.value;
}

function cacheSet<T>(
  m: Map<string, CacheEntry<T>>,
  k: string,
  v: T,
  ttlMs: number,
) {
  const now = Date.now();
  m.set(k, { value: v, expiresAt: now + Math.max(1, ttlMs) });
}

/**
 * ===== Status helpers (COB) =====
 * Para Jornada 3, /v2/rec exige txid "ATIVA".
 */
function isTerminalNotUsableCobStatus(status?: CobStatus | string) {
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
}

function isCobUsableForJourney3Activation(
  status: CobStatus | unknown,
): boolean {
  const s = String(status ?? "")
    .toUpperCase()
    .trim();
  return s === "ATIVA";
}

export const pixAutoClient = {
  locrec: {
    async create(body: CreateLocRecRequest = {}): Promise<LocRecResponse> {
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        { op: "POST /v2/locrec", url: "/v2/locrec", method: "POST" },
        async () => {
          const res = await http.post<LocRecResponse>("/v2/locrec", body);
          return res.data;
        },
      );
    },
  },

  cob: {
    async create(body: CreateCobRequest): Promise<CobResponse> {
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        { op: "POST /v2/cob", url: "/v2/cob", method: "POST" },
        async () => {
          const res = await http.post<CobResponse>("/v2/cob", body);
          if (res.data?.txid) assertValidTxid(res.data.txid);
          return res.data;
        },
      );
    },

    async put(txid: string, body: CreateCobRequest): Promise<CobResponse> {
      const safeTxid = normalizeTxid(txid);
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        {
          op: "PUT /v2/cob/:txid",
          url: `/v2/cob/${safeTxid}`,
          method: "PUT",
          txid: safeTxid,
        },
        async () => {
          const res = await http.put<CobResponse>(
            `/v2/cob/${encodeURIComponent(safeTxid)}`,
            body,
          );
          if (res.data?.txid) assertValidTxid(res.data.txid);
          return res.data;
        },
      );
    },

    async get(txid: string): Promise<CobResponse> {
      const safeTxid = normalizeTxid(txid);
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        {
          op: "GET /v2/cob/:txid",
          url: `/v2/cob/${safeTxid}`,
          method: "GET",
          txid: safeTxid,
        },
        async () => {
          const res = await http.get<CobResponse>(
            `/v2/cob/${encodeURIComponent(safeTxid)}`,
          );
          return res.data;
        },
      );
    },

    /**
     * ✅ LISTA de COB (fonte de verdade pra reconciliação retroativa)
     */
    async list(query: CobListQuery): Promise<CobListResponse> {
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        { op: "GET /v2/cob", url: "/v2/cob", method: "GET" },
        async () => {
          const res = await http.get<CobListResponse>("/v2/cob", {
            params: query,
          });
          return res.data;
        },
      );
    },

    /**
     * ✅ GET com cache curto (TTL) para dedupe em retries/backoff.
     * Observação: isso NÃO substitui a propagação necessária do /v2/rec (J3),
     * mas reduz carga e logs duplicados.
     */
    async getCached(
      txid: string,
      opts?: { dedupeTtlMs?: number },
    ): Promise<CobResponse> {
      const safeTxid = normalizeTxid(txid);
      const ttl = opts?.dedupeTtlMs ?? 1500;

      const cached = cacheGet(cobCache, safeTxid);
      if (cached) return cached;

      const value = await this.get(safeTxid);
      cacheSet(cobCache, safeTxid, value, ttl);
      return value;
    },

    /**
     * ✅ Status terminal e NÃO usável para ativação da Jornada 3.
     */
    isTerminalNotUsableStatus(status: CobStatus | unknown): boolean {
      return isTerminalNotUsableCobStatus(String(status ?? ""));
    },

    /**
     * ✅ Único status considerado usável para ativação na Jornada 3.
     */
    isUsableForJourney3Activation(status: CobStatus | unknown): boolean {
      return isCobUsableForJourney3Activation(status);
    },
  },

  rec: {
    async create(body: CreateRecRequest): Promise<RecResponse> {
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        { op: "POST /v2/rec", url: "/v2/rec", method: "POST" },
        async () => {
          const res = await http.post<RecResponse>("/v2/rec", body);
          return res.data;
        },
      );
    },

    async get(idRec: string, opts?: { txid?: string }): Promise<RecResponse> {
      const safeIdRec = normalizeId("idRec", idRec);

      const txid = opts?.txid ? String(opts.txid).trim() : "";
      if (txid) assertValidTxid(txid);

      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        {
          op: "GET /v2/rec/:idRec",
          url: `/v2/rec/${safeIdRec}`,
          method: "GET",
          idRec: safeIdRec,
          txid: txid || undefined,
        },
        async () => {
          const res = await http.get<RecResponse>(
            `/v2/rec/${encodeURIComponent(safeIdRec)}`,
            {
              params: txid ? { txid } : undefined,
            },
          );
          return res.data;
        },
      );
    },

    async list(query: {
      inicio: string;
      fim: string;
      paginaAtual?: number;
      itensPorPagina?: number;
      status?: string;
      cpf?: string;
      cnpj?: string;
    }): Promise<unknown> {
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        { op: "GET /v2/rec", url: "/v2/rec", method: "GET" },
        async () => {
          const res = await http.get("/v2/rec", { params: query });
          return res.data as unknown;
        },
      );
    },
  },

  /**
   * ✅ COBR (Pix Automático - cobrança associada à recorrência)
   * Importante: isso é DIFERENTE de /v2/cob (cobrança imediata).
   */
  cobr: {
    async create(body: CreateCobrRequest): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        { op: "POST /v2/cobr", url: "/v2/cobr", method: "POST" },
        async () => {
          const res = await http.post<CobrResponse>("/v2/cobr", { cobr: body });
          if (res.data?.txid) assertValidTxid(res.data.txid);
          return res.data;
        },
      );
    },

    async put(txid: string, body: CreateCobrRequest): Promise<CobrResponse> {
      const safeTxid = normalizeTxid(txid);
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        {
          op: "PUT /v2/cobr/:txid",
          url: `/v2/cobr/${safeTxid}`,
          method: "PUT",
          txid: safeTxid,
        },
        async () => {
          const res = await http.put<CobrResponse>(
            `/v2/cobr/${encodeURIComponent(safeTxid)}`,
            { cobr: body },
          );
          if (res.data?.txid) assertValidTxid(res.data.txid);
          return res.data;
        },
      );
    },

    async get(txid: string): Promise<CobrResponse> {
      const safeTxid = normalizeTxid(txid);
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        {
          op: "GET /v2/cobr/:txid",
          url: `/v2/cobr/${safeTxid}`,
          method: "GET",
          txid: safeTxid,
        },
        async () => {
          const res = await http.get<CobrResponse>(
            `/v2/cobr/${encodeURIComponent(safeTxid)}`,
          );
          return res.data;
        },
      );
    },

    async patch(txid: string, body: PatchCobrRequest): Promise<CobrResponse> {
      const safeTxid = normalizeTxid(txid);
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        {
          op: "PATCH /v2/cobr/:txid",
          url: `/v2/cobr/${safeTxid}`,
          method: "PATCH",
          txid: safeTxid,
        },
        async () => {
          const res = await http.patch<CobrResponse>(
            `/v2/cobr/${encodeURIComponent(safeTxid)}`,
            body,
          );
          return res.data;
        },
      );
    },

    async list(query: CobrListQuery): Promise<CobrListResponse> {
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        { op: "GET /v2/cobr", url: "/v2/cobr", method: "GET" },
        async () => {
          const res = await http.get<CobrListResponse>("/v2/cobr", {
            params: query,
          });
          const data = res.data ?? ({} as CobrListResponse);

          // normaliza para sempre existir cobsr
          const cobsr = data.cobsr ?? data.cobrs ?? [];
          return { ...data, cobsr };
        },
      );
    },
  },

  /**
   * ✅ SOLICREC (solicitação de confirmação/aceite)
   */
  solicrec: {
    async create(body: CreateSolicRecRequest): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      const idRec = normalizeId("idRec", body.idRec);
      return withAxiosLog(
        http,
        { op: "POST /v2/solicrec", url: "/v2/solicrec", method: "POST", idRec },
        async () => {
          const res = await http.post<SolicRecResponse>("/v2/solicrec", body);
          return res.data;
        },
      );
    },

    async get(idSolicRec: string): Promise<SolicRecResponse> {
      const safe = normalizeId("idSolicRec", idSolicRec);
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        {
          op: "GET /v2/solicrec/:idSolicRec",
          url: `/v2/solicrec/${safe}`,
          method: "GET",
          idSolicRec: safe,
        },
        async () => {
          const res = await http.get<SolicRecResponse>(
            `/v2/solicrec/${encodeURIComponent(safe)}`,
          );
          return res.data;
        },
      );
    },

    async patch(
      idSolicRec: string,
      body: Partial<CreateSolicRecRequest>,
    ): Promise<SolicRecResponse> {
      const safe = normalizeId("idSolicRec", idSolicRec);
      const http = getEfiHttpClient();
      return withAxiosLog(
        http,
        {
          op: "PATCH /v2/solicrec/:idSolicRec",
          url: `/v2/solicrec/${safe}`,
          method: "PATCH",
          idSolicRec: safe,
        },
        async () => {
          const res = await http.patch<SolicRecResponse>(
            `/v2/solicrec/${encodeURIComponent(safe)}`,
            body,
          );
          return res.data;
        },
      );
    },
  },

  /**
   * ===== Detecção de erros (para fluxos resilientes) =====
   * Aqui você centraliza regras semânticas baseadas em "violacoes".
   */
  errors: {
    /**
     * “A cobrança referenciada por rec.ativacao.dadosJornada.txid não está ativa.”
     * (ou variantes com acento/sem acento)
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
          includesAll(r, ["cobran", "txid", "ativa", "não"]) ||
          includesAll(r, ["cobran", "txid", "ativa", "nao"]) ||
          includesAll(r, ["txid", "ativa", "não"]) ||
          includesAll(r, ["txid", "ativa", "nao"]);

        return propertyOk && reasonOk;
      });
    },

    /**
     * locrec reutilizado (heurística por violação)
     */
    isRecLocAlreadyUsed(err: unknown): boolean {
      return hasViolation(err, (v) => {
        const p = lower(v.propriedade);
        const r = lower(v.razao);

        const propertyOk = p.includes("body.rec.loc") || p.includes("rec.loc");
        const reasonOk =
          r.includes("loc") ||
          r.includes("location") ||
          r.includes("utiliz") ||
          r.includes("usado") ||
          r.includes("utilizado");

        return propertyOk && reasonOk;
      });
    },

    /**
     * Contrato já possui recorrência ativa (heurístico)
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
     * txid expirou (heurístico)
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
     * ✅ 5xx (Efí/BCB) ao criar recorrência
     */
    isRecInternalServerError(err: unknown): boolean {
      if (!isAxiosError(err)) return false;
      const status = err.response?.status ?? 0;
      return status >= 500;
    },

    /**
     * Namespace: COB (cobrança imediata)
     */
    cob: {
      isTerminalNotUsableStatus(status: CobStatus | unknown): boolean {
        return isTerminalNotUsableCobStatus(String(status ?? ""));
      },

      isUsableForJourney3Activation(status: CobStatus | unknown): boolean {
        return isCobUsableForJourney3Activation(status);
      },
    },
  },
};
