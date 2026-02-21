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
  loc: number; // obrigatório na Jornada 3
}>;

function normalizeMoney(value: string): string {
  // aceita "10", "10.5", "10,50", "0010,50" -> "10.50"
  const raw = value.trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Valor inválido.");
  return n.toFixed(2);
}

type CobPutBody = Readonly<{
  calendario: { expiracao: number };
  valor: { original: string };
  chave: string;
  solicitacaoPagador?: string;
  // loc?: number  // ⚠️ só inclua se o erro real NÃO reclamar
}>;

export const pixAutoClient = {
  locrec: {
    async create(body: CreateLocRecRequest = {}): Promise<LocRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post("/v2/locrec", body);
      return res.data;
    },
    async get(locId: number): Promise<LocRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.get(`/v2/locrec/${locId}`);
      return res.data;
    },
  },

  // ✅ Helpers específicos pro seu fluxo
  journey3: {
    async createCobImmediate(
      params: Journey3CobImmediateParams,
    ): Promise<CobResponse> {
      const pixKey = process.env.EFI_PIX_KEY ?? "";
      if (!pixKey) throw new Error("EFI_PIX_KEY não definida no .env");

      const body: CobPutBody = {
        calendario: { expiracao: 3600 },
        valor: { original: normalizeMoney(params.valor) },
        chave: pixKey,
        ...(params.solicitacaoPagador
          ? { solicitacaoPagador: params.solicitacaoPagador }
          : {}),
        // ⚠️ COMEÇE SEM loc. Se o erro real não reclamar, você adiciona depois.
      };

      // se você quer testar loc, habilite com feature flag:
      const enableLoc = process.env.EFI_ENABLE_J3_LOC === "true";
      if (enableLoc) {
        // aqui não dá pra manter CobPutBody readonly sem ajustar, então faça assim:
        const withLoc = { ...body, loc: params.loc };
        return pixAutoClient.cob.put(params.txid, withLoc);
      }

      return pixAutoClient.cob.put(params.txid, body);
    },
  },

  cob: {
    async create(body: CreateCobRequest): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.post("/v2/cob", body);
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
      const res = await http.get(`/v2/cob/${encodeURIComponent(txid)}`);
      return res.data;
    },
    async patch(txid: string, body: { status: string }): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.patch(`/v2/cob/${encodeURIComponent(txid)}`, body);
      return res.data;
    },
  },

  rec: {
    async create(body: CreateRecRequest): Promise<RecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post("/v2/rec", body);
      return res.data;
    },
    // ✅ já está certo: aceita opts (txid) como 2º argumento
    async get(idRec: string, opts?: { txid?: string }): Promise<RecResponse> {
      const http = getEfiHttpClient();
      const res = await http.get(`/v2/rec/${encodeURIComponent(idRec)}`, {
        params: opts?.txid ? { txid: opts.txid } : undefined,
      });
      return res.data;
    },
    async patch(
      idRec: string,
      body: Partial<CreateRecRequest>,
    ): Promise<RecResponse> {
      const http = getEfiHttpClient();
      const res = await http.patch(
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
      return res.data;
    },
  },

  solicrec: {
    async create(body: CreateSolicRecRequest): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post("/v2/solicrec", body);
      return res.data;
    },
    async get(idSolicRec: string): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.get(
        `/v2/solicrec/${encodeURIComponent(idSolicRec)}`,
      );
      return res.data;
    },
    async patch(
      idSolicRec: string,
      body: { status: string },
    ): Promise<SolicRecResponse> {
      const http = getEfiHttpClient();
      const res = await http.patch(
        `/v2/solicrec/${encodeURIComponent(idSolicRec)}`,
        body,
      );
      return res.data;
    },
  },

  cobr: {
    async create(body: CreateCobrRequest): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.post("/v2/cobr", body);
      return res.data;
    },
    async put(txid: string, body: CreateCobrRequest): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.put(`/v2/cobr/${encodeURIComponent(txid)}`, body);
      return res.data;
    },
    async get(txid: string): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.get(`/v2/cobr/${encodeURIComponent(txid)}`);
      return res.data;
    },
    async patch(txid: string, body: { status: string }): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.patch(
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
      return res.data;
    },
    async requestRetentativa(txid: string, data: string) {
      const http = getEfiHttpClient();
      const res = await http.post(
        `/v2/cobr/${encodeURIComponent(txid)}/retentativa/${encodeURIComponent(data)}`,
      );
      return res.data;
    },
  },
};
