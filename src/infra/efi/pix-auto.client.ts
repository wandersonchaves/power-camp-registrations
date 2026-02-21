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
  RecResponse,
  SolicRecResponse,
} from "./pix-auto.types";

export type Journey3CobImmediateParams = Readonly<{
  txid: string;
  valor: string;
  solicitacaoPagador?: string;
  loc: number; // usado opcionalmente via feature flag
}>;

function normalizeMoney(value: string): string {
  const raw = value.trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Valor inválido.");
  return n.toFixed(2);
}

function assertEnv(name: string): string {
  const v = process.env[name] ?? "";
  if (!v) throw new Error(`${name} não definida no .env`);
  return v;
}

type CobPutBodyBase = Readonly<{
  calendario: { expiracao: number };
  valor: { original: string };
  chave: string;
  solicitacaoPagador?: string;
}>;

type CobPutBodyWithLoc = CobPutBodyBase & Readonly<{ loc: number }>;

export const pixAutoClient = {
  locrec: {
    async create(body: CreateLocRecRequest = {}): Promise<LocRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<LocRecResponse>("/v2/locrec", body);
      return res.data;
    },
    async get(locId: number): Promise<LocRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.get<LocRecResponse>(`/v2/locrec/${locId}`);
      return res.data;
    },
  },

  journey3: {
    /**
     * ✅ Cria COB via PUT /v2/cob/:txid (idempotência real no provedor).
     * ⚠️ `loc` pode gerar 400 dependendo do endpoint/contrato. Use feature flag para testar.
     */
    async createCobImmediate(
      params: Journey3CobImmediateParams,
    ): Promise<CobResponse> {
      const pixKey = assertEnv("EFI_PIX_KEY");

      const baseBody: CobPutBodyBase = {
        calendario: { expiracao: 3600 },
        valor: { original: normalizeMoney(params.valor) },
        chave: pixKey,
        ...(params.solicitacaoPagador
          ? { solicitacaoPagador: params.solicitacaoPagador }
          : {}),
      };

      const enableLoc = process.env.EFI_ENABLE_J3_LOC === "true";
      if (enableLoc) {
        const withLoc: CobPutBodyWithLoc = { ...baseBody, loc: params.loc };
        return pixAutoClient.cob.put(params.txid, withLoc);
      }

      return pixAutoClient.cob.put(params.txid, baseBody);
    },
  },

  cob: {
    async create(body: CreateCobRequest): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<CobResponse>("/v2/cob", body);
      return res.data;
    },
    async put(txid: string, body: CreateCobRequest): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.put<CobResponse>(
        `/v2/cob/${encodeURIComponent(txid)}`,
        body,
      );
      return res.data;
    },
    async get(txid: string): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.get<CobResponse>(
        `/v2/cob/${encodeURIComponent(txid)}`,
      );
      return res.data;
    },
    async patch(txid: string, body: { status: string }): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.patch<CobResponse>(
        `/v2/cob/${encodeURIComponent(txid)}`,
        body,
      );
      return res.data;
    },
  },

  rec: {
    async create(body: CreateRecRequest): Promise<RecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<RecResponse>("/v2/rec", body);
      return res.data;
    },
    async get(idRec: string, opts?: { txid?: string }): Promise<RecResponse> {
      const http = getEfiHttpClient();
      const res = await http.get<RecResponse>(
        `/v2/rec/${encodeURIComponent(idRec)}`,
        {
          params: opts?.txid ? { txid: opts.txid } : undefined,
        },
      );
      return res.data;
    },
    async patch(
      idRec: string,
      body: Partial<CreateRecRequest>,
    ): Promise<RecResponse> {
      const http = getEfiHttpClient();
      const res = await http.patch<RecResponse>(
        `/v2/rec/${encodeURIComponent(idRec)}`,
        body,
      );
      return res.data;
    },
    async list(params: {
      inicio: string;
      fim: string;
      cpf?: string;
      cnpj?: string;
      status?: string;
      pagina?: number;
      itensPorPagina?: number;
    }) {
      const http = getEfiHttpClient();
      const res = await http.get("/v2/rec", { params });
      return res.data as unknown;
    },
  },

  solicrec: {
    async create(body: CreateSolicRecRequest): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post<SolicRecResponse>("/v2/solicrec", body);
      return res.data;
    },
    async get(idSolicRec: string): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.get<SolicRecResponse>(
        `/v2/solicrec/${encodeURIComponent(idSolicRec)}`,
      );
      return res.data;
    },
    async patch(
      idSolicRec: string,
      body: { status: string },
    ): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.patch<SolicRecResponse>(
        `/v2/solicrec/${encodeURIComponent(idSolicRec)}`,
        body,
      );
      return res.data;
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
    async get(txid: string): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.get<CobrResponse>(
        `/v2/cobr/${encodeURIComponent(txid)}`,
      );
      return res.data;
    },
    async patch(txid: string, body: { status: string }): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.patch<CobrResponse>(
        `/v2/cobr/${encodeURIComponent(txid)}`,
        body,
      );
      return res.data;
    },
    async list(params: {
      inicio: string;
      fim: string;
      idRec?: string;
      cpf?: string;
      cnpj?: string;
      status?: string;
      convenio?: string;
      pagina?: number;
      itensPorPagina?: number;
    }) {
      const http = getEfiHttpClient();
      const res = await http.get("/v2/cobr", { params });
      return res.data as unknown;
    },
    async requestRetentativa(txid: string, data: string) {
      const http = getEfiHttpClient();
      const res = await http.post(
        `/v2/cobr/${encodeURIComponent(txid)}/retentativa/${encodeURIComponent(data)}`,
      );
      return res.data as unknown;
    },
  },
};
