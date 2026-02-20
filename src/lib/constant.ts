import { env } from "@/env.mjs";

export const siteConfig = {
  title: "Next Power",
  description:
    "A Next.js power template, packed with features like TypeScript, Tailwind CSS, Next-auth, Eslint, testing tools and more. Jumpstart your project with efficiency and style.",
  keywords: [
    "Next.js",
    "React",
    "Next.js power",
    "Next.js boilerplate",
    "Power Template",
    "Tailwind CSS",
    "TypeScript",
    "Shadcn/ui",
    "Next-auth",
    "Prisma",
  ],
  url: env.APP_URL,
  googleSiteVerificationId: env.GOOGLE_SITE_VERIFICATION_ID ?? "",
};
