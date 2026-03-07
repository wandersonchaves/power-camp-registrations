# Next Power - Event Enrollment & PIX Payments

Next Power is a comprehensive event management and enrollment platform built with **Next.js 15 (App Router)**. It is specifically designed to handle event registrations (like the "Power Camp" or "Couples' Trip") with integrated PIX payment processing via the **EFI (Gerencianet)** SDK.

## 🚀 Project Overview

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, React 19)
- **Architecture:** Clean architecture principles with a focus on domain logic in `src/use-cases` and infrastructure in `src/infra`.
- **Database:** [PostgreSQL](https://www.postgresql.org/) managed via [Prisma ORM](https://www.prisma.io/).
- **Authentication:** [NextAuth.js](https://next-auth.js.org/) with Google provider.
- **Payments:** Integrated PIX payments (immediate and recurring/automatic) using the [EFI Node.js SDK](https://github.com/gerencianet/gn-api-sdk-node).
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [Shadcn/UI](https://ui.shadcn.com/) components and [Lucide React](https://lucide.dev/) icons.
- **Validation:** [Zod](https://zod.dev/) for schema validation and [React Hook Form](https://react-hook-form.com/) for form management.

## 🛠️ Building and Running

### Prerequisites

- Node.js (Latest LTS recommended)
- PostgreSQL database
- EFI (Gerencianet) credentials (Client ID, Secret, PIX Key, and Certificates)

### Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Configure environment:**
    Copy `.env.example` to `.env` and fill in the required variables (DATABASE_URL, EFI credentials, etc.).
3.  **Generate Prisma client:**
    ```bash
    npm run prisma:generate
    ```
4.  **Run migrations:**
    ```bash
    npm run db:migrate
    ```

### Key Commands

- `npm run dev`: Starts the development server with Turbo.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run test`: Runs unit tests with Jest.
- `npm run e2e`: Runs end-to-end tests with Playwright.
- `npm run reconcile:efi`: Runs payment reconciliation scripts.

## 📐 Development Conventions

### Code Structure

- **App Router:** All routes and pages are located in `src/app`.
- **Components:** Reusable UI components are in `src/components`, with specialized components in `src/components/ui`.
- **Infrastructure:** All external service integrations (EFI, Auth) are in `src/infra` and `src/lib/auth`.
- **Use Cases:** Core business logic is encapsulated in `src/use-cases`.
- **Schemas:** Prisma schema is at `prisma/schema.prisma`. Zod schemas for validation are often co-located with their usage or in `src/types`.

### Payment Logic (EFI PIX)

The core of the payment system resides in `src/infra/efi`. It handles:

- **Immediate PIX (`PixCobImmediate`):** For one-time enrollment fees.
- **Automatic PIX (`PixAutoRecurrence`):** For recurring payments/installments.
- **Webhooks:** Listens for payment notifications from EFI.

### Configuration

- **Business Rules:** Change event-specific constants (dates, values, messages) in `src/config/business.ts`.
- **Environment:** Managed via `src/env.mjs` using `@t3-oss/env-nextjs` for type-safe environment variables.

### Quality Control

- **Linting:** ESLint with a strict configuration (`npm run lint`).
- **Formatting:** Prettier for consistent code style (`npm run format`).
- **Commits:** Follows conventional commits enforced by Commitlint and Husky.
