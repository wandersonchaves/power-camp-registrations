// src/infra/efi/pix-auto.types.ts

// pattern para permitir novos valores sem perder autocomplete
type OpenStringUnion<T extends string> = T | (string & {});

export type Periodicidade = OpenStringUnion<
  "MENSAL" | "SEMANAL" | "ANUAL" | "DIARIA" | "TRIMESTRAL" | "SEMESTRAL"
>;

export type RecStatus = OpenStringUnion<
  "CRIADA" | "APROVADA" | "REPROVADA" | "CANCELADA" | "EXPIRADA"
>;

export type SolicRecStatus = OpenStringUnion<
  "CRIADA" | "CANCELADA" | "EXPIRADA" | "APROVADA"
>;

export type CobrStatus = OpenStringUnion<
  "CRIADA" | "ATIVA" | "CANCELADA" | "AGENDADA" | "EXPIRADA" | "CONCLUIDA"
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

export type CreateRecRequest = {
  vinculo: {
    contrato: string;
    devedor: { cpf: string; nome: string };
    objeto?: string;
  };
  calendario: {
    dataInicial: string; // YYYY-MM-DD
    dataFinal?: string; // YYYY-MM-DD
    periodicidade: Periodicidade;
  };
  valor: { valorRec: string };
  politicaRetentativa?: string;
  loc?: number;
  ativacao?: { dadosJornada?: { txid?: string } };
};

export type RecResponse = {
  idRec: string;
  status: RecStatus;
  valor?: { valorRec: string };
  calendario?: {
    dataInicial: string;
    dataFinal?: string;
    periodicidade: string;
  };
  vinculo?: {
    contrato: string;
    objeto?: string;
    devedor?: { cpf: string; nome: string };
  };
  loc?: { id: number; location: string; criacao?: string; idRec?: string };
  dadosQR?: { jornada?: string; pixCopiaECola?: string };

  // compatibilidade para campos extras
  [k: string]: unknown;
};

export type CreateSolicRecRequest = {
  idRec: string;
  calendario: { dataExpiracaoSolicitacao: string }; // ISO datetime
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
  calendario: { dataExpiracaoSolicitacao: string };
  destinatario: {
    agencia: string;
    conta: string;
    cpf: string;
    ispbParticipante: string;
  };
  recPayload?: unknown;

  [k: string]: unknown;
};

export type CreateCobrRequest = {
  idRec: string;
  infoAdicional?: string;
  calendario: { dataDeVencimento: string }; // YYYY-MM-DD
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

export type CobrResponse = {
  idRec: string;
  txid: string;
  status: CobrStatus;
  valor?: { original: string };
  calendario?: { criacao?: string; dataDeVencimento: string };
  infoAdicional?: string;
  ajusteDiaUtil?: boolean;
  politicaRetentativa?: string;

  [k: string]: unknown;
};

export type LocRecResponse = {
  id: number;
  location: string;
  tipoCob?: string;
  criacao?: string;

  [k: string]: unknown;
};

export type CreateLocRecRequest = Record<string, never>;

export type CreateCobRequest = {
  calendario?: { expiracao?: number };
  devedor?: {
    cpf?: string; // /^\d{11}$/
    cnpj?: string; // /^\d{14}$/
    nome: string;
  };
  valor: { original: string };
  chave?: string;
  solicitacaoPagador?: string;
  infoAdicionais?: Array<{ nome: string; valor: string }>;
  loc?: { id: number };
};

export type PatchCobrRequest = {
  status: "CANCELADA" | string;
  infoAdicional?: string;
};

export type CobResponse = {
  txid: string;
  status: CobStatus;
  valor?: { original?: string };
  calendario?: { criacao?: string; expiracao?: number };
  chave?: string;
  solicitacaoPagador?: string;

  location?: string;
  loc?: { id: number; location: string; criacao?: string; tipoCob?: string };

  pixCopiaECola?: string;

  pix?: Array<unknown>;

  devedor?: { cpf?: string; cnpj?: string; nome?: string };

  [k: string]: unknown;
};
