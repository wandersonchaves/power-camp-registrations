import {createEnv} from '@t3-oss/env-nextjs'
import {z} from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().url().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url().optional(),
    NEXTAUTH_SECRET: z.string().min(1),
    EFI_CLIENT_ID: z.string().min(1),
    EFI_CLIENT_SECRET: z.string().min(1),
    EFI_PIX_CERT: z.string().min(1),
    EFI_API_BASE_URL: z.string().min(1),
    GOOGLE_SITE_VERIFICATION_ID: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_EFI_CLIENT_ID: z.string().min(1),
    NEXT_PUBLIC_EFI_CLIENT_SECRET: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    APP_URL: process.env.APP_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    EFI_CLIENT_ID: process.env.EFI_CLIENT_ID,
    EFI_CLIENT_SECRET: process.env.EFI_CLIENT_SECRET,
    EFI_PIX_CERT: process.env.EFI_PIX_CERT,
    NEXT_PUBLIC_EFI_CLIENT_ID: process.env.NEXT_PUBLIC_EFI_CLIENT_ID,
    NEXT_PUBLIC_EFI_CLIENT_SECRET: process.env.NEXT_PUBLIC_EFI_CLIENT_SECRET,
    EFI_API_BASE_URL: process.env.EFI_API_BASE_URL,
    GOOGLE_SITE_VERIFICATION_ID: process.env.GOOGLE_SITE_VERIFICATION_ID,
  },
})
