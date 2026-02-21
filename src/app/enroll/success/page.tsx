// src/app/enroll/success/page.tsx
import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { refreshRecurrence } from "./actions";

import { PixQr } from "@/components/pix/PixQr";
import { prisma } from "@/lib/prisma";

type SearchParams = Record<string, string | string[] | undefined>;
function pickString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export const runtime = "nodejs";

/** ===== Payload types (best-effort / backward compatible) ===== */
type PlanPayload = {
  ticketTotalTarget?: unknown;
  ticketTotalEffective?: unknown;
  installments?: unknown;
  installmentAmount?: unknown;
  firstPaymentAmount?: unknown;
  recurringAmount?: unknown;
  recurringCount?: unknown;
  isSinglePayment?: unknown;
  roundingDifference?: unknown;
};

type AttemptPayload = {
  ticketType?: unknown; // "ANTECIPADA" | "LOTE_ZERO"
  teamCode?: unknown; // "AGUIA" | "LEAO" | null
  plan?: PlanPayload;
  cob?: { pixCopiaECola?: unknown | null };
  ticket?: {
    // fallback (quando plan não existe/está inconsistente)
    immediateAmount?: unknown;
    recurringAmount?: unknown;
    periodicidade?: unknown;
    dataInicial?: unknown;
    dataFinal?: unknown;
    contrato?: unknown;
    objeto?: unknown;
    teamCode?: unknown;
  };
};

function asObject(
  v: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function toStringSafe(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * Aceita:
 * - "250.00"
 * - "250,00"
 * - 250
 * - "20.83"
 */
function moneyToNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (typeof v === "string") {
    const s = v.trim().replace(/\./g, ".").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function formatBRL(v: unknown): string {
  const n = moneyToNumber(v);
  if (n === null) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function isNonZeroMoney(v: unknown): boolean {
  const n = moneyToNumber(v);
  return n !== null && Math.abs(n) > 0;
}

function resolveEventTotalByTicketType(ticketType: string | null): string {
  // defaults seguros (server-side)
  if (ticketType === "LOTE_ZERO") {
    return process.env.POWERCAMP_LOTE_ZERO_TOTAL ?? "0.00";
  }
  return process.env.POWERCAMP_ANTECIPADA_TOTAL ?? "250.00";
}

type UiSummary = {
  total: unknown;
  entryNow: unknown;
  installments: number | null;
  monthly: unknown;
  showRoundingNote: boolean;
};

function buildUiSummary(params: {
  payload: AttemptPayload;
  attemptAmount: unknown;
  recurrenceMonthly: unknown;
}): UiSummary {
  const { payload, attemptAmount, recurrenceMonthly } = params;

  const ticketType = toStringSafe(payload.ticketType);
  const plan = payload.plan ?? {};

  const total =
    plan.ticketTotalTarget ?? resolveEventTotalByTicketType(ticketType) ?? null;

  // ✅ Entrada: plan -> attempt.amount -> cob.valor.original -> ticket.immediateAmount
  const cobOriginal =
    payload?.cob && typeof payload.cob === "object"
      ? ((payload.cob as { valor?: { original?: string }; original?: string })
          ?.valor?.original ?? (payload.cob as { original?: string })?.original)
      : undefined;

  const entryNow =
    plan.firstPaymentAmount ??
    attemptAmount ??
    cobOriginal ??
    payload.ticket?.immediateAmount ??
    null;

  const installments = toInt(plan.installments);

  // ✅ Mensalidade: plan -> recurrence.valorRec -> ticket.recurringAmount
  const monthly =
    plan.recurringAmount ??
    recurrenceMonthly ??
    payload.ticket?.recurringAmount ??
    null;

  const showRoundingNote = isNonZeroMoney(plan.roundingDifference);

  return { total, entryNow, installments, monthly, showRoundingNote };
}

export default async function EnrollSuccessPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const enrollmentId = pickString(searchParams.enrollmentId) ?? "";

  if (!enrollmentId) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          Inscrição não encontrada (ID ausente).
        </div>
      </div>
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      status: true,
      eventId: true,
      participantId: true,
      team: { select: { name: true } },
      participant: { select: { fullName: true } },
      initialPayment: {
        select: {
          txid: true,
          status: true,
          amount: true,
          payload: true,
          paidAt: true,
        },
      },
    },
  });

  if (!enrollment) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          Inscrição não encontrada.
        </div>
      </div>
    );
  }

  const recurrence = await prisma.pixAutoRecurrence.findFirst({
    where: {
      participantId: enrollment.participantId,
      eventId: enrollment.eventId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      pixCopiaECola: true,
      jornada: true,
      valorRec: true,
      periodicidade: true,
    },
  });

  const payload = asObject(
    enrollment.initialPayment?.payload,
  ) as AttemptPayload;
  const plan = payload.plan;

  const cobPixRaw = payload?.cob?.pixCopiaECola ?? null;
  const cobPix =
    typeof cobPixRaw === "string" ? cobPixRaw : cobPixRaw == null ? null : null;

  const isPaid = Boolean(enrollment.initialPayment?.paidAt);

  const ui = buildUiSummary({
    payload,
    attemptAmount: enrollment.initialPayment?.amount ?? null,
    recurrenceMonthly: recurrence?.valorRec ?? null,
  });

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-xl space-y-4 px-4 py-10">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">
            {isPaid ? "Inscrição confirmada ✅" : "Inscrição gerada ✅"}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {isPaid
              ? "Pagamento identificado. Tudo certo!"
              : "Para confirmar, pague a entrada via Pix abaixo."}
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div>
              <span className="font-medium">Participante:</span>{" "}
              {enrollment.participant.fullName}
            </div>
            <div>
              <span className="font-medium">Equipe:</span>{" "}
              {enrollment.team?.name ?? "Lote Zero (sem equipe)"}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
            <div className="text-sm font-semibold">Resumo</div>
            <div className="mt-2 grid gap-1 text-sm">
              <div>
                Total do evento:{" "}
                <span className="font-medium">{formatBRL(ui.total)}</span>
              </div>
              <div>
                Entrada (agora):{" "}
                <span className="font-medium">{formatBRL(ui.entryNow)}</span>
              </div>
              <div>
                Parcelas:{" "}
                <span className="font-medium">{ui.installments ?? "—"}x</span>
              </div>
              <div>
                Mensalidade:{" "}
                <span className="font-medium">{formatBRL(ui.monthly)}</span>
              </div>

              {ui.showRoundingNote ? (
                <div className="text-xs text-gray-600">
                  Pode haver um pequeno ajuste de centavos para fechar o total.
                </div>
              ) : null}

              {/* (Opcional para admin/debug: deixa escondido em produção se quiser) */}
              {plan?.ticketTotalEffective != null ? (
                <div className="text-xs text-gray-500">
                  Total efetivo: {formatBRL(plan.ticketTotalEffective)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            {!isPaid ? (
              cobPix ? (
                <PixQr value={cobPix} title="Pix de entrada (pague agora)" />
              ) : (
                <div className="rounded-2xl border bg-gray-50 p-4 text-sm">
                  Não foi possível carregar o Pix de entrada. Tente atualizar a
                  página.
                </div>
              )
            ) : (
              <div className="rounded-2xl border bg-green-50 p-4 text-sm text-green-900">
                Pagamento da entrada identificado ✅
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
            <div className="text-sm font-semibold">Mensalidade automática</div>
            <p className="mt-1 text-sm text-gray-700">
              {recurrence?.status
                ? "Mensalidade configurada ✅"
                : "Estamos preparando a mensalidade automática… (pode levar alguns instantes)"}
            </p>

            {recurrence?.pixCopiaECola ? (
              <div className="mt-3">
                <div className="text-xs font-semibold">
                  Copia e cola (mensalidade) — opcional
                </div>
                <textarea
                  readOnly
                  className="mt-2 h-28 w-full rounded-2xl border bg-white p-3 font-mono text-xs outline-none"
                  value={recurrence.pixCopiaECola}
                />
                <p className="mt-2 text-xs text-gray-600">
                  Você normalmente não precisa disso. A mensalidade roda
                  automaticamente.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-600">
                Se ainda não apareceu, clique em “Atualizar” e aguarde alguns
                segundos.
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <form action={refreshRecurrence} className="flex-1">
                <input
                  type="hidden"
                  name="enrollmentId"
                  value={enrollment.id}
                />
                <button
                  type="submit"
                  className="w-full rounded-2xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Atualizar
                </button>
              </form>

              <Link
                href="/admin/race"
                className="flex-1 rounded-2xl bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-gray-800"
              >
                Ver placar
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/enroll"
              className="block w-full rounded-2xl border bg-white px-4 py-3 text-center text-sm font-medium hover:bg-gray-50"
            >
              Nova inscrição
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
