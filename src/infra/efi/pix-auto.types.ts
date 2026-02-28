// src/infra/efi/pix-auto.types.ts

/** Pattern para permitir novos valores sem perder autocomplete */
export type OpenStringUnion<T extends string> = T | (string & {});

/** Datas */
export type IsoDateTime = string; // 2026-02-28T10:19:52.566Z
export type YmdDate = string; // 2026-03-01

/** Paginação padronizada do EFI/BCB */
export type EfiPagination = {
  paginaAtual: number;
  itensPorPagina: number;
  quantidadeDePaginas: number;
  quantidadeTotalDeItens: number;
};

/** Chaves que a API espera como query params */
export type EfiPagedQuery = {
  inicio: IsoDateTime;
  fim: IsoDateTime;
  "paginacao.paginaAtual"?: number;
  "paginacao.itensPorPagina"?: number;
};

/** Query comum de filtros */
export type EfiCommonFilters = {
  cpf?: string;
  cnpj?: string;
  status?: string;
};

/** Query base: janela + paginação + filtros comuns */
export type EfiListQueryBase = EfiPagedQuery & EfiCommonFilters;

/** Response base de listagem */
export type EfiListResponseBase = {
  parametros: {
    inicio?: IsoDateTime; // algumas respostas trazem
    fim?: IsoDateTime;
    paginacao: Partial<EfiPagination> & {
      paginaAtual: number;
      quantidadeDePaginas: number;
      itensPorPagina?: number;
      quantidadeTotalDeItens?: number;
    };
  };
};

/** Utils de domínio */
export type Periodicidade = OpenStringUnion<
  "MENSAL" | "SEMANAL" | "ANUAL" | "DIARIA" | "TRIMESTRAL" | "SEMESTRAL"
>;

export type CobStatus = OpenStringUnion<
  | "CRIADA"
  | "ATIVA"
  | "CONCLUIDA"
  | "REMOVIDA_PELO_USUARIO_RECEBEDOR"
  | "REMOVIDA_PELO_PSP"
  | "EXPIRADA"
  | "CANCELADA"
>;

export type CobrStatus = OpenStringUnion<
  "CRIADA" | "ATIVA" | "CANCELADA" | "AGENDADA" | "EXPIRADA" | "CONCLUIDA"
>;

export type RecStatus = OpenStringUnion<
  "CRIADA" | "APROVADA" | "REPROVADA" | "CANCELADA" | "EXPIRADA"
>;

export type SolicRecStatus = OpenStringUnion<
  "CRIADA" | "CANCELADA" | "EXPIRADA" | "APROVADA"
>;

/** Objetos comuns */
export type EfiDevedor = {
  cpf?: string; // /^\d{11}$/
  cnpj?: string; // /^\d{14}$/
  nome?: string;
};

export type EfiValorOriginal = { original?: string };
export type EfiValorRec = { valorRec: string };

export type EfiCalendarioCob = { criacao?: IsoDateTime; expiracao?: number };
export type EfiCalendarioCobr = {
  criacao?: IsoDateTime;
  dataDeVencimento: YmdDate;
};
export type EfiCalendarioRec = {
  dataInicial: YmdDate;
  dataFinal?: YmdDate;
  periodicidade: Periodicidade | string;
};

export type EfiPixLite = {
  endToEndId?: string;
  horario?: IsoDateTime;
  valor?: string;
};

/**
 * ====== COB (imediata) ======
 */
export type CreateCobRequest = {
  calendario?: { expiracao?: number };
  devedor?: {
    cpf?: string;
    cnpj?: string;
    nome: string;
  };
  valor: { original: string };
  chave?: string;
  solicitacaoPagador?: string;
  infoAdicionais?: Array<{ nome: string; valor: string }>;
  loc?: { id: number };
};

export type CobResponse = {
  txid: string;
  status: CobStatus;
  valor?: EfiValorOriginal;
  calendario?: EfiCalendarioCob;
  chave?: string;
  solicitacaoPagador?: string;

  location?: string;
  loc?: {
    id: number;
    location: string;
    criacao?: IsoDateTime;
    tipoCob?: string;
  };

  pixCopiaECola?: string;
  pix?: unknown[]; // mantém unknown; extração via guard
  devedor?: EfiDevedor;

  [k: string]: unknown;
};

/** Versão “lite” para listagem (o list costuma vir mais “solto”) */
export type EfiCobLite = {
  txid?: string;
  status?: CobStatus | string; // pode vir vazio/inesperado no list
  calendario?: EfiCalendarioCob;
  valor?: EfiValorOriginal;
  pix?: unknown; // pode ser array/obj; extração via guard
  [k: string]: unknown;
};

/** Query e Response do /v2/cob (list) */
export type CobListQuery = EfiListQueryBase;

export type CobListResponse = EfiListResponseBase & {
  cobs?: EfiCobLite[];
};

/**
 * ====== REC (recorrência / mandato) ======
 */
export type CreateLocRecRequest = Record<string, never>;

export type LocRecResponse = {
  id: number;
  location: string;
  tipoCob?: string;
  criacao?: IsoDateTime;
  [k: string]: unknown;
};

export type CreateRecRequest = {
  vinculo: {
    contrato: string;
    devedor: { cpf: string; nome: string };
    objeto?: string;
  };
  calendario: {
    dataInicial: YmdDate;
    dataFinal?: YmdDate;
    periodicidade: Periodicidade;
  };
  valor: EfiValorRec;
  politicaRetentativa?: string;
  loc?: number;
  ativacao?: { dadosJornada?: { txid?: string } };
};

export type RecResponse = {
  idRec: string;
  status: RecStatus;
  valor?: EfiValorRec;
  calendario?: EfiCalendarioRec;
  vinculo?: {
    contrato: string;
    objeto?: string;
    devedor?: { cpf: string; nome: string };
  };
  loc?: { id: number; location: string; criacao?: IsoDateTime; idRec?: string };
  dadosQR?: { jornada?: string; pixCopiaECola?: string };
  [k: string]: unknown;
};

export type CreateSolicRecRequest = {
  idRec: string;
  calendario: { dataExpiracaoSolicitacao: IsoDateTime };
  destinatario: {
    agencia: string;
    conta: string;
    cpf: string;
    ispbParticipante: string;
  };
};

export type SolicRecResponse = {
  idSolicRec: string;
  idRec: string;
  status: SolicRecStatus;
  calendario: { dataExpiracaoSolicitacao: IsoDateTime };
  destinatario: {
    agencia: string;
    conta: string;
    cpf: string;
    ispbParticipante: string;
  };
  recPayload?: unknown;
  [k: string]: unknown;
};

/**
 * ====== COBR (cobrança recorrente / “fatura do mês”) ======
 */
export type CreateCobrRequest = {
  idRec: string;
  infoAdicional?: string;
  calendario: { dataDeVencimento: YmdDate };
  valor: { original: string };
  ajusteDiaUtil?: boolean;
  devedor?: {
    cep?: string;
    cidade?: string;
    email?: string;
    logradouro?: string;
    uf?: string;
  };
  recebedor?: {
    agencia?: string;
    conta?: string;
    tipoConta?: string;
  };
};

export type PatchCobrRequest = {
  status: "CANCELADA" | string;
  infoAdicional?: string;
};

export type CobrResponse = {
  idRec: string;
  txid: string;
  status: CobrStatus;
  valor?: { original: string };
  calendario?: EfiCalendarioCobr;
  infoAdicional?: string;
  ajusteDiaUtil?: boolean;
  politicaRetentativa?: string;
  [k: string]: unknown;
};

/** Query do /v2/cobr (list) */
export type CobrListQuery = EfiListQueryBase & {
  idRec?: string;
  convenio?: string;
};

/** Alguns endpoints retornam "cobsr", outros "cobrs". Padronize no client. */
export type CobrListResponse = EfiListResponseBase & {
  cobsr?: CobrResponse[];
  cobrs?: CobrResponse[];
  cobsrTotal?: number; // opcional, se você quiser enriquecer
};
