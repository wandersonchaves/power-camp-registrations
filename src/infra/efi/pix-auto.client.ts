import { getEfiHttpClient } from "./efi.http";
import type {
  CobrResponse,
  CreateCobrRequest,
  CreateRecRequest,
  CreateSolicRecRequest,
  RecResponse,
  SolicRecResponse,
} from "./pix-auto.types";

export const pixAutoClient = {
  rec: {
    async create(body: CreateRecRequest): Promise<RecResponse> {
      const http = getEfiHttpClient();
      const res = await http.post("/v2/rec", body);
      return res.data;
    },
    async get(idRec: string): Promise<RecResponse> {
      const http = getEfiHttpClient();
      const res = await http.get(`/v2/rec/${encodeURIComponent(idRec)}`);
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
      // doc mostra 201 em alguns casos; axios aceita igualmente
      const res = await http.patch(
        `/v2/solicrec/${encodeURIComponent(idSolicRec)}`,
        body,
      );
      return res.data;
    },
  },

  cobr: {
    // POST /v2/cobr (PSP define txid)
    async create(body: CreateCobrRequest): Promise<CobrResponse> {
      const http = getEfiHttpClient();
      const res = await http.post("/v2/cobr", body);
      return res.data;
    },
    // PUT /v2/cobr/:txid (você define txid)
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
