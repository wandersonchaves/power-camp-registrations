# Power Camp Registrations

Event registration and payments platform used in production by a church in Teresina, Brazil, for its yearly youth camp. Participants sign up, join a team and pay with **Pix**, either upfront or in monthly installments through **Pix Automático** (Brazil's recurring Pix). Organizers follow enrollments, team progress and installments from an admin dashboard.

## What it does

- **Enrollment:** public sign-up form with team selection. It creates the enrollment and starts the Pix Automático authorization flow (Jornada 3: first payment plus recurrence consent).
- **Payments with Efí (Gerencianet) Pix API:** immediate charges (`cob`), recurrences (`rec`) and recurring charges (`cobr`), over mTLS.
- **Webhooks:** endpoints for `cob`, `cobr` and `rec` events. Each event is persisted with a unique `(kind, externalId)` key before processing, so a resent webhook is not applied twice.
- **Reconciliation:** jobs and an admin endpoint compare local state with Efí and fix pending or missed charges (`pnpm reconcile:efi`).
- **Admin dashboard:** enrollments, teams and a team race scoreboard, installment tracking, retrying a failed charge and creating an ad-hoc charge for a recurrence.
- **Migration:** moving existing payers from an older recurring flow to the new one, with an audit log.

## Architecture

```
Next.js App Router (pages + route handlers)
        │
        ▼
src/use-cases/      enrollment · pix-auto · webhooks · reconcile · migration · race
        │
        ├──► src/infra/efi/   Efí Pix API client (mTLS, OAuth)
        └──► Prisma ──► PostgreSQL
```

Route handlers stay thin: they validate input, call a use case and map errors to HTTP responses. The business rules live in `src/use-cases`.

## Stack

Next.js 15 · React · TypeScript · Prisma · PostgreSQL · NextAuth (Google) · Efí Pix API · Tailwind CSS · shadcn/ui · Jest · Playwright

## Running locally

```bash
pnpm install
cp .env.example .env    # database, NextAuth, Google and Efí credentials
pnpm db:migrate
pnpm dev
```

Efí requires a client certificate (`EFI_CERT_PEM_PATH`, `EFI_CERT_KEY_PEM_PATH`). Use the Efí sandbox (`EFI_ENV`) for development.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm test` | Unit tests (Jest) |
| `pnpm e2e` | End-to-end tests (Playwright) |
| `pnpm reconcile:efi` | Reconciles local charges with Efí |
| `pnpm typecheck` | TypeScript check |
