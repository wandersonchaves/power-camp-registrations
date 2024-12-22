import {env} from '@/env.mjs'

export const siteConfig = {
  title: 'Next Carnet',
  description:
    'A Next.js carnet template, packed with features like TypeScript, Tailwind CSS, Next-auth, Eslint, testing tools and more. Jumpstart your project with efficiency and style.',
  keywords: [
    'Next.js',
    'React',
    'Next.js carnet',
    'Next.js boilerplate',
    'Carnet Template',
    'Tailwind CSS',
    'TypeScript',
    'Shadcn/ui',
    'Next-auth',
    'Prisma',
  ],
  url: env.APP_URL,
  googleSiteVerificationId: env.GOOGLE_SITE_VERIFICATION_ID ?? '',
}
