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

  cob: {
    async create(body: CreateCobRequest): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.post("/v2/cob", body);
      return res.data;
    },
    async put(txid: string, body: CreateCobRequest): Promise<CobResponse> {
      const http = getEfiHttpClient();
      const res = await http.put(`/v2/cob/${encodeURIComponent(txid)}`, body);
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
