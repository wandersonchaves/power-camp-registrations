// src/infra/efi/efi.config.ts
import fs from "node:fs";

type EfiEnv = "PROD" | "SANDBOX";

/**
 * ✅ EFI Config (Railway-friendly + Local-friendly)
 *
 * Prioridade de certificado (nessa ordem):
 *  1) PFX Base64 (Railway / env)  -> EFI_PFX_BASE64 + EFI_PASSPHRASE (pode ser "")
 *  2) PFX path (local/VM)         -> EFI_PFX_PATH + EFI_PASSPHRASE (pode ser "")
 *  3) PEM cert/key (local/legado) -> EFI_CERT_PEM_PATH + EFI_CERT_KEY_PEM_PATH (+ EFI_CERT_PASSPHRASE opcional)
 *
 * Base URL (Pix API):
 *  - Se EFI_BASE_URL existir, usa ela
 *  - Senão, resolve via EFI_ENV (default: SANDBOX em dev, PROD em prod)
 *
 * OBS:
 * - Entrega um Buffer (`p12`) quando PFX, e paths quando PEM.
 * - Aceita passphrase vazia "" (mas exige que a variável exista quando usar PFX).
 */
export type EfiConfig = Readonly<{
  baseUrl: string;
  env: EfiEnv;

  clientId: string;
  clientSecret: string;

  /** ✅ Buffer do certificado PFX (.p12/.pfx) já carregado/decodificado */
  p12?: Buffer;

  /**
   * ✅ Passphrase do PFX.
   * Pode ser string vazia "" (cert sem senha).
   * Deve existir (não pode ser undefined) quando p12 existe.
   */
  passphrase?: string;

  /** ✅ Fallback (dev/legado): caminhos PEM */
  certPemPath?: string;
  certKeyPemPath?: string;
  certPassphrase?: string;
}>;

let cfgSingleton: EfiConfig | null = null;

/** trim padrão (bom para ids/secrets) */
function envTrim(name: string): string {
  return String(process.env[name] ?? "").trim();
}

/** optional com trim (string vazia vira undefined) */
function optionalTrim(name: string): string | undefined {
  const v = envTrim(name);
  return v ? v : undefined;
}

/**
 * ✅ RAW (não dá trim) para permitir "" (passphrase vazia).
 * - undefined => variável não existe
 * - "" => variável existe e está vazia
 */
function optionalRaw(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  return String(v);
}

function requireEnv(name: string, missing: string[]) {
  const v = envTrim(name);
  if (!v) missing.push(name);
  return v;
}

function normalizeBaseUrl(url: string): string {
  const u = url.trim();
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function resolveEnv(): EfiEnv {
  const raw = (optionalTrim("EFI_ENV") ?? "").toUpperCase();

  // ✅ defaults mais seguros:
  // - em produção (NODE_ENV=production) default PROD
  // - em dev default SANDBOX
  const defaultEnv = process.env.NODE_ENV === "production" ? "PROD" : "SANDBOX";

  const normalized = (raw || defaultEnv).toUpperCase();
  return normalized === "PROD" ? "PROD" : "SANDBOX";
}

/**
 * ✅ Rotas base oficiais da API Pix Efí (Pix e Pix Automático):
 * Produção:    https://pix.api.efipay.com.br
 * Homologação: https://pix-h.api.efipay.com.br
 */
function resolveBaseUrl(env: EfiEnv): string {
  const explicit = optionalTrim("EFI_BASE_URL");
  if (explicit) return normalizeBaseUrl(explicit);

  return env === "SANDBOX"
    ? "https://pix-h.api.efipay.com.br"
    : "https://pix.api.efipay.com.br";
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

  // validação simples mas útil: p12 costuma virar um base64 grande
  if (payload.length < 500) {
    throw new Error(
      "EFI_PFX_BASE64 parece inválido (muito curto). Garanta que é o base64 COMPLETO do .p12/.pfx.",
    );
  }

  try {
    return Buffer.from(payload, "base64");
  } catch {
    throw new Error(
      "EFI_PFX_BASE64 inválido. Verifique se está realmente em base64 (ou data-url base64).",
    );
  }
}

function fileToBufferOrThrow(path: string): Buffer {
  if (!fs.existsSync(path)) {
    throw new Error(
      `Não foi possível encontrar o arquivo em EFI_PFX_PATH: ${path}`,
    );
  }
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
  const pfxBase64 = optionalTrim("EFI_PFX_BASE64");
  const pfxPath = optionalTrim("EFI_PFX_PATH");

  const certPemPath = optionalTrim("EFI_CERT_PEM_PATH");
  const certKeyPemPath = optionalTrim("EFI_CERT_KEY_PEM_PATH");
  const certPassphrase = optionalRaw("EFI_CERT_PASSPHRASE"); // pode ser ""

  // Passphrase (PFX) - pode ser ""
  const passphrase =
    optionalRaw("EFI_PASSPHRASE") ?? optionalRaw("EFI_P12_PASSPHRASE");

  if (missing.length) {
    throw new Error(
      `Variáveis de ambiente obrigatórias não definidas: ${missing.join(", ")}`,
    );
  }

  const hasPfxBase64 = Boolean(pfxBase64);
  const hasPfxPath = Boolean(pfxPath);
  const hasPemPair = Boolean(certPemPath && certKeyPemPath);

  if (!hasPfxBase64 && !hasPfxPath && !hasPemPair) {
    throw new Error(
      [
        "Certificado EFI não encontrado.",
        "Defina UMA das opções:",
        '- EFI_PFX_BASE64 + EFI_PASSPHRASE (pode ser vazio "")',
        '- EFI_PFX_PATH + EFI_PASSPHRASE (pode ser vazio "")',
        "- EFI_CERT_PEM_PATH + EFI_CERT_KEY_PEM_PATH (EFI_CERT_PASSPHRASE opcional)",
      ].join("\n"),
    );
  }

  const baseCfg: Omit<
    EfiConfig,
    "p12" | "passphrase" | "certPemPath" | "certKeyPemPath" | "certPassphrase"
  > = {
    env,
    baseUrl,
    clientId,
    clientSecret,
  };

  // 1) PFX base64 (Railway/Vercel)
  if (hasPfxBase64) {
    // exige existir (pode ser "")
    if (passphrase === undefined) {
      throw new Error(
        'EFI_PASSPHRASE não definido. Ele pode ser vazio "", mas precisa existir quando usar EFI_PFX_BASE64.',
      );
    }

    const p12 = decodePfxBase64OrThrow(pfxBase64 as string);

    cfgSingleton = {
      ...baseCfg,
      p12,
      passphrase,
    };

    return cfgSingleton;
  }

  // 2) PFX path (local)
  if (hasPfxPath) {
    if (passphrase === undefined) {
      throw new Error(
        'EFI_PASSPHRASE não definido. Ele pode ser vazio "", mas precisa existir quando usar EFI_PFX_PATH.',
      );
    }

    const p12 = fileToBufferOrThrow(pfxPath as string);

    cfgSingleton = {
      ...baseCfg,
      p12,
      passphrase,
    };

    return cfgSingleton;
  }

  // 3) PEM pair
  if (!certPemPath || !certKeyPemPath) {
    throw new Error(
      "EFI_CERT_PEM_PATH e EFI_CERT_KEY_PEM_PATH são obrigatórios quando usar certificado PEM.",
    );
  }

  if (!fs.existsSync(certPemPath)) {
    throw new Error(`EFI_CERT_PEM_PATH não encontrado: ${certPemPath}`);
  }
  if (!fs.existsSync(certKeyPemPath)) {
    throw new Error(`EFI_CERT_KEY_PEM_PATH não encontrado: ${certKeyPemPath}`);
  }

  cfgSingleton = {
    ...baseCfg,
    certPemPath,
    certKeyPemPath,
    ...(certPassphrase !== undefined ? { certPassphrase } : {}),
  };

  return cfgSingleton;
}
