// src/env.mjs
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),

    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url().optional(),

    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_SITE_VERIFICATION_ID: z.string().optional(),

    EFI_BASE_URL: z.string().url().optional(),
    EFI_ENV: z.enum(["development", "homologation", "production"]).optional(),
    EFI_CLIENT_ID: z.string().min(1),
    EFI_CLIENT_SECRET: z.string().min(1),
    EFI_PIX_KEY: z.string().min(1),

    EFI_CERT_PEM_PATH: z.string().optional(),
    EFI_CERT_KEY_PEM_PATH: z.string().optional(),
    EFI_CERT_PASSPHRASE: z.string().optional(),

    EFI_DEFAULT_COB_EXP_SECONDS: z.coerce.number().int().positive().optional(),
    EFI_WEBHOOK_HMAC: z.string().optional(),
    EFI_WEBHOOK_ALLOW_IPS: z.string().optional(),
    EFI_WEBHOOK_SKIP_MTLS: z.coerce.boolean().optional(),

    WEBHOOK_SHARED_SECRET: z.string().optional(),

    POWERCAMP_EVENT_ID: z.string().optional(),
    POWERCAMP_OWNER_USER_ID: z.string().optional(),
    POWERCAMP_ANTECIPADA_TOTAL: z.coerce.number().optional(),
    POWERCAMP_LOTE_ZERO_TOTAL: z.coerce.number().optional(),
  },

  runtimeEnv: {
    APP_URL: process.env.APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,

    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,

    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_SITE_VERIFICATION_ID: process.env.GOOGLE_SITE_VERIFICATION_ID,

    EFI_BASE_URL: process.env.EFI_BASE_URL,
    EFI_ENV: process.env.EFI_ENV,
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
});
