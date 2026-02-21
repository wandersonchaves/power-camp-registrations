// src/infra/efi/efi.config.ts
import fs from "node:fs";

type EfiEnv = "PROD" | "SANDBOX";

/**
 * ✅ EFI Config (Railway-friendly + Local-friendly)
 *
 * Prioridade de certificado (nessa ordem):
 *  1) PFX Base64 (Railway / env)  -> EFI_PFX_BASE64 + EFI_PASSPHRASE
 *  2) PFX path (local/VM)         -> EFI_PFX_PATH + EFI_PASSPHRASE
 *  3) PEM cert/key (legado/local) -> EFI_CERT_PEM_PATH + EFI_CERT_KEY_PEM_PATH (+ EFI_CERT_PASSPHRASE opcional)
 *
 * Base URL:
 *  - Se EFI_BASE_URL existir, usa ela
 *  - Senão, resolve via EFI_ENV (default: PROD)
 */
export type EfiConfig = Readonly<{
  baseUrl: string;
  env: EfiEnv;

  clientId: string;
  clientSecret: string;

  /**
   * ✅ Buffer do certificado PFX (.p12/.pfx) já decodificado/carregado
   * - Presente quando usar EFI_PFX_BASE64 ou EFI_PFX_PATH
   * - Isso resolve o erro: "Property 'p12' does not exist on type 'EfiConfig'"
   */
  p12?: Buffer;

  /** ✅ Passphrase do PFX (.p12/.pfx). Obrigatória quando p12 existe */
  passphrase?: string;

  /** ✅ Fallback (dev/legado): caminhos PEM */
  certPemPath?: string;
  certKeyPemPath?: string;
  certPassphrase?: string;
}>;

let cfgSingleton: EfiConfig | null = null;

function envStr(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function optionalEnv(name: string): string | undefined {
  const v = envStr(name);
  return v ? v : undefined;
}

function requireEnv(name: string, missing: string[]) {
  const v = envStr(name);
  if (!v) missing.push(name);
  return v;
}

function normalizeBaseUrl(url: string): string {
  const u = url.trim();
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function resolveEnv(): EfiEnv {
  const raw = (optionalEnv("EFI_ENV") ?? "PROD").toUpperCase();
  return raw === "SANDBOX" ? "SANDBOX" : "PROD";
}

/**
 * ✅ Ajuste aqui as URLs oficiais conforme seu contrato/ambiente Efí.
 * - PROD geralmente: https://api.efipay.com.br
 * - HOMOLOG/SANDBOX geralmente: https://api-h.efipay.com.br
 */
function resolveBaseUrl(env: EfiEnv): string {
  const explicit = optionalEnv("EFI_BASE_URL");
  if (explicit) return normalizeBaseUrl(explicit);
  return env === "SANDBOX"
    ? "https://api-h.efipay.com.br"
    : "https://api.efipay.com.br";
}

function extractBase64Payload(v: string): string {
  const raw = v.trim();

  // aceita data-url: data:application/x-pkcs12;base64,AAAA...
  if (raw.startsWith("data:")) {
    const idx = raw.indexOf("base64,");
    if (idx === -1) return raw;
    return raw.slice(idx + "base64,".length);
  }

  return raw;
}

function decodePfxBase64OrThrow(v: string): Buffer {
  const payload = extractBase64Payload(v).replace(/\s/g, "");
  try {
    return Buffer.from(payload, "base64");
  } catch {
    throw new Error(
      "EFI_PFX_BASE64 inválido. Verifique se está realmente em base64 (ou data-url base64).",
    );
  }
}

function fileToBufferOrThrow(path: string): Buffer {
  try {
    return fs.readFileSync(path);
  } catch {
    throw new Error(`Não foi possível ler o arquivo em EFI_PFX_PATH: ${path}`);
  }
}

export function getEfiConfig(): EfiConfig {
  if (cfgSingleton) return cfgSingleton;

  const missing: string[] = [];

  const env = resolveEnv();
  const baseUrl = resolveBaseUrl(env);

  const clientId = requireEnv("EFI_CLIENT_ID", missing);
  const clientSecret = requireEnv("EFI_CLIENT_SECRET", missing);

  // Cert sources
  const pfxBase64 = optionalEnv("EFI_PFX_BASE64");
  const pfxPath = optionalEnv("EFI_PFX_PATH");

  const certPemPath = optionalEnv("EFI_CERT_PEM_PATH");
  const certKeyPemPath = optionalEnv("EFI_CERT_KEY_PEM_PATH");
  const certPassphrase = optionalEnv("EFI_CERT_PASSPHRASE");

  // Passphrase (PFX)
  const passphrase =
    optionalEnv("EFI_PASSPHRASE") ?? optionalEnv("EFI_P12_PASSPHRASE");

  // ✅ Se faltou clientId/secret, já falha com lista completa
  if (missing.length) {
    throw new Error(
      `Variáveis de ambiente obrigatórias não definidas: ${missing.join(", ")}`,
    );
  }

  // ✅ Validação de presença de certificado
  const hasPfxBase64 = Boolean(pfxBase64);
  const hasPfxPath = Boolean(pfxPath);
  const hasPemPair = Boolean(certPemPath && certKeyPemPath);

  if (!hasPfxBase64 && !hasPfxPath && !hasPemPair) {
    throw new Error(
      [
        "Certificado EFI não encontrado.",
        "Defina UMA das opções:",
        "- EFI_PFX_BASE64 + EFI_PASSPHRASE (recomendado na Railway)",
        "- EFI_PFX_PATH + EFI_PASSPHRASE",
        "- EFI_CERT_PEM_PATH + EFI_CERT_KEY_PEM_PATH (PEM) (EFI_CERT_PASSPHRASE opcional)",
      ].join("\n"),
    );
  }

  // ✅ Monta config final
  const cfg: EfiConfig = {
    env,
    baseUrl,
    clientId,
    clientSecret,
  };

  // PFX base64 (Railway)
  if (hasPfxBase64) {
    if (!passphrase) {
      throw new Error(
        "EFI_PASSPHRASE não definido. É obrigatório quando usar EFI_PFX_BASE64.",
      );
    }
    const p12 = decodePfxBase64OrThrow(pfxBase64 as string);
    cfgSingleton = {
      ...cfg,
      p12,
      passphrase,
    };
    return cfgSingleton;
  }

  // PFX path (local)
  if (hasPfxPath) {
    if (!passphrase) {
      throw new Error(
        "EFI_PASSPHRASE não definido. É obrigatório quando usar EFI_PFX_PATH.",
      );
    }
    const p12 = fileToBufferOrThrow(pfxPath as string);
    cfgSingleton = {
      ...cfg,
      p12,
      passphrase,
    };
    return cfgSingleton;
  }

  // PEM pair (fallback)
  if (!certPemPath || !certKeyPemPath) {
    throw new Error(
      "EFI_CERT_PEM_PATH e EFI_CERT_KEY_PEM_PATH são obrigatórios quando usar certificado PEM.",
    );
  }

  cfgSingleton = {
    ...cfg,
    certPemPath,
    certKeyPemPath,
    ...(certPassphrase ? { certPassphrase } : {}),
  };

  return cfgSingleton;
}
