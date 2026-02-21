// src/infra/efi/txid.ts
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 32);

/**
 * TXID random (32 chars) - seguro e compatível (alfanum, 26..35)
 */
export function generateTxid(): string {
  return nanoid();
}

/**
 * Efí/Pix: TXID alfanumérico, 26..35 caracteres.
 * (Seu buildTxid determinístico deve produzir dentro disso.)
 */
export function assertValidTxid(txid: string) {
  const v = String(txid ?? "").trim();

  // aceita A-Z a-z 0-9 (sem símbolos)
  const ok = /^[A-Za-z0-9]{26,35}$/.test(v);
  if (!ok) {
    throw new Error(
      `TXID inválido: "${v}". Esperado: alfanumérico (A-Z a-z 0-9) e tamanho 26..35.`,
    );
  }
}
