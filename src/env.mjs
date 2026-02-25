// src/env.mjs
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Helpers
 */
const zBoolFromString = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s) return undefined;
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return v;
}, z.boolean());

const zIntFromString = z.preprocess((v) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : v;
}, z.number().int());

/**
 * Env schema
 * - Coloque aqui tudo que seu app realmente usa.
 * - O que é obrigatório em produção, mantenha obrigatório aqui.
 */
export const env = createEnv({
  server: {
    // App
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.string().url().min(1),

    // DB
    DATABASE_URL: z.string().min(1),

    // Auth
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url().optional(),

    // Google OAuth / SEO
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_SITE_VERIFICATION_ID: z.string().optional(),

    // EFI / Pix
    EFI_ENV: z.enum(["HMG", "PRD"]).default("HMG"),
    EFI_BASE_URL: z.string().url().optional(), // opcional: override manual
    EFI_CLIENT_ID: z.string().min(1),
    EFI_CLIENT_SECRET: z.string().min(1),

    EFI_PIX_KEY: z.string().min(1),

    // Certificados (mtls)
    EFI_CERT_PEM_PATH: z.string().min(1),
    EFI_CERT_KEY_PEM_PATH: z.string().min(1),
    EFI_CERT_PASSPHRASE: z.string().optional(),

    // Defaults / tuning
    EFI_DEFAULT_COB_EXP_SECONDS: zIntFromString
      .min(60)
      .max(24 * 60 * 60)
      .default(3600),

    // Webhooks (EFI + internos)
    EFI_WEBHOOK_HMAC: z.string().min(1),
    EFI_WEBHOOK_ALLOW_IPS: z.string().optional(), // ex: "1.2.3.4,5.6.7.8"
    EFI_WEBHOOK_SKIP_MTLS: zBoolFromString.default(false),

    WEBHOOK_SHARED_SECRET: z.string().optional(),

    // PowerCamp / negócio
    POWERCAMP_EVENT_ID: z.string().optional(),
    POWERCAMP_OWNER_USER_ID: z.string().optional(),
    POWERCAMP_ANTECIPADA_TOTAL: zIntFromString.optional(),
    POWERCAMP_LOTE_ZERO_TOTAL: zIntFromString.optional(),
  },

  /**
   * runtimeEnv deve listar EXATAMENTE as keys acima (server/client).
   * (boas práticas do @t3-oss/env-nextjs)
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.APP_URL,

    DATABASE_URL: process.env.DATABASE_URL,

    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,

    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_SITE_VERIFICATION_ID: process.env.GOOGLE_SITE_VERIFICATION_ID,

    EFI_ENV: process.env.EFI_ENV,
    EFI_BASE_URL: process.env.EFI_BASE_URL,
    EFI_CLIENT_ID: process.env.EFI_CLIENT_ID,
    EFI_CLIENT_SECRET: process.env.EFI_CLIENT_SECRET,
    EFI_PIX_KEY: process.env.EFI_PIX_KEY,

    EFI_CERT_PEM_PATH: process.env.EFI_CERT_PEM_PATH,
    EFI_CERT_KEY_PEM_PATH: process.env.EFI_CERT_KEY_PEM_PATH,
    EFI_CERT_PASSPHRASE: process.env.EFI_CERT_PASSPHRASE,

    EFI_DEFAULT_COB_EXP_SECONDS: process.env.EFI_DEFAULT_COB_EXP_SECONDS,

    EFI_WEBHOOK_HMAC: process.env.EFI_WEBHOOK_HMAC,
    EFI_WEBHOOK_ALLOW_IPS: process.env.EFI_WEBHOOK_ALLOW_IPS,
    EFI_WEBHOOK_SKIP_MTLS: process.env.EFI_WEBHOOK_SKIP_MTLS,

    WEBHOOK_SHARED_SECRET: process.env.WEBHOOK_SHARED_SECRET,

    POWERCAMP_EVENT_ID: process.env.POWERCAMP_EVENT_ID,
    POWERCAMP_OWNER_USER_ID: process.env.POWERCAMP_OWNER_USER_ID,
    POWERCAMP_ANTECIPADA_TOTAL: process.env.POWERCAMP_ANTECIPADA_TOTAL,
    POWERCAMP_LOTE_ZERO_TOTAL: process.env.POWERCAMP_LOTE_ZERO_TOTAL,
  },

  /**
   * Evita validação durante build em alguns pipelines (ex.: Docker)
   * - Se não usa, pode remover.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,

  /**
   * Para Next.js Edge, você provavelmente NÃO quer isso.
   * Mantido padrão.
   */
  emptyStringAsUndefined: true,
});
