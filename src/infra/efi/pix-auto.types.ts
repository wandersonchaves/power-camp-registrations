// src/infra/efi/pix-auto.types.ts
export type Periodicidade = "MENSAL" | "SEMANAL" | "ANUAL" | "DIARIA" | string;

export type RecStatus =
  | "CRIADA"
  | "APROVADA"
  | "REPROVADA"
  | "CANCELADA"
  | string;

export type SolicRecStatus =
  | "CRIADA"
  | "CANCELADA"
  | "EXPIRADA"
  | "APROVADA"
  | string;

export type CobrStatus =
  | "CRIADA"
  | "ATIVA"
  | "CANCELADA"
  | "AGENDADA"
  | "EXPIRADA"
  | string;

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
};

export type LocRecResponse = {
  id: number;
  location: string;
  tipoCob?: string;
  criacao?: string;
};

export type CreateLocRecRequest = Record<string, never>;

// ✅ Cobrança imediata: adiciona `loc?: number` (Jornada 3)
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

  // ✅ quando precisar usar loc em COB, o formato correto é objeto, não number
  loc?: { id: number };
};

export type CobResponse = {
  txid: string;
  status: string;
  valor?: { original: string };
  calendario?: { criacao?: string; expiracao?: number };
  location?: string;
  loc?: { id: number; location: string; criacao?: string; tipoCob?: string };
  pixCopiaECola?: string;
  devedor?: { cpf?: string; cnpj?: string; nome?: string };
};
