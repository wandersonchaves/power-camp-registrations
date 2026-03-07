// src/app/enroll/success/page.tsx
import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { AutoRefreshPayment } from "./_components/AutoRefreshPayment.client";
import { PixCopyPaste } from "./_components/PixCopyPaste.client";
import { refreshRecurrence } from "./actions";

import { PixQr } from "@/components/pix/PixQr";
import { TeamBadge } from "@/components/teams/team-badge";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { TeamCode } from "@/theme/team-config";
import { getTeamGradient } from "@/theme/team-styles";

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
      team: { select: { name: true, code: true } },
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

  // ✅ MELHOR PRÁTICA: Priorizar o QR da Recorrência (Jornada 3)
  // Ele contém o pagamento da entrada + a autorização das próximas.
  const cobPixRaw =
    recurrence?.pixCopiaECola ?? payload?.cob?.pixCopiaECola ?? null;
  const cobPix = typeof cobPixRaw === "string" ? cobPixRaw : null;

  const isPaid = Boolean(enrollment.initialPayment?.paidAt);

  const ui = buildUiSummary({
    payload,
    attemptAmount: enrollment.initialPayment?.amount ?? null,
    recurrenceMonthly: recurrence?.valorRec ?? null,
  });

  const teamCode = enrollment.team?.code as TeamCode | undefined;

  return (
    <main className="min-h-screen bg-gray-50 pb-20 text-gray-900">
      {/* Visual Header based on team */}
      {teamCode && (
        <div
          className={cn("mb-[-64px] h-32 w-full", getTeamGradient(teamCode))}
        />
      )}

      <div className="mx-auto max-w-xl space-y-4 px-4 pt-10">
        <div className="relative overflow-hidden rounded-3xl border bg-white p-8 shadow-xl">
          {teamCode && (
            <div className="absolute right-0 top-0 p-4 opacity-10">
              <span className="text-8xl">
                {teamCode === "AGUIA" ? "🦅" : "🦁"}
              </span>
            </div>
          )}

          <div className="mb-6">
            {teamCode ? (
              <TeamBadge team={teamCode} className="mb-2" />
            ) : (
              <div className="mb-2 inline-flex items-center rounded-md border bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-800">
                Lote Zero
              </div>
            )}
            <h1 className="text-3xl font-black tracking-tight">
              {isPaid ? "Inscrição Confirmada!" : "Inscrição Gerada!"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              {isPaid
                ? "Seu lugar está garantido na arena. Tudo certo!"
                : "Quase lá! Realize o pagamento para garantir sua vaga."}
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                Participante
              </span>
              <span className="text-lg font-bold">
                {enrollment.participant.fullName}
              </span>
            </div>

            <div className="border-muted bg-muted/30 rounded-2xl border-2 border-dashed p-5">
              <div className="text-muted-foreground mb-3 text-sm font-bold uppercase tracking-widest">
                Resumo Financeiro
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Total do Evento:
                  </span>
                  <span className="text-lg font-bold">
                    {formatBRL(ui.total)}
                  </span>
                </div>
                <div className="border-muted flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">
                    Entrada (Pix agora):
                  </span>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      !isPaid &&
                        (teamCode === "AGUIA"
                          ? "text-blue-600"
                          : "text-red-600"),
                    )}
                  >
                    {formatBRL(ui.entryNow)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-muted-foreground">Parcelas:</span>
                  <span className="font-bold">
                    {ui.installments ?? "—"}x de {formatBRL(ui.monthly)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <AutoRefreshPayment enrollmentId={enrollment.id} enabled={!isPaid} />

          {/* Seção de Pagamento Unificada */}
          <div className="mt-8 space-y-6">
            {!isPaid ? (
              <div
                className={cn(
                  "rounded-2xl border-2 p-6 shadow-sm transition-all",
                  teamCode === "AGUIA"
                    ? "border-blue-100 bg-blue-50/30"
                    : "border-red-100 bg-red-50/30",
                )}
              >
                {cobPix ? (
                  <div className="space-y-6">
                    <PixQr value={cobPix} title="Pagamento de Entrada" />

                    <div className="space-y-4">
                      <PixCopyPaste value={cobPix} label="Copia e Cola" />

                      <p className="text-muted-foreground text-[11px] italic leading-relaxed">
                        * Este Pix realiza o pagamento da entrada e autoriza
                        automaticamente as próximas mensalidades.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground p-4 text-center text-sm italic">
                    Gerando seu QR Code... por favor, aguarde alguns instantes
                    ou atualize a página.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-green-200 bg-green-50/50 p-6 text-center shadow-sm">
                <div className="mb-2 text-3xl">✅</div>
                <h3 className="text-lg font-bold text-green-900">
                  Pagamento Identificado
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  Sua entrada foi processada com sucesso e sua vaga está
                  garantida!
                </p>
              </div>
            )}

            {/* Status da Recorrência */}
            <div className="bg-muted/20 rounded-2xl border p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "size-2 rounded-full",
                      recurrence?.status
                        ? "animate-pulse bg-green-500"
                        : "bg-amber-500",
                    )}
                  />
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Recorrência Automática
                  </span>
                </div>
                {recurrence?.status && (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase text-green-700">
                    Ativa
                  </span>
                )}
              </div>

              <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                {recurrence?.status
                  ? "Tudo pronto! As próximas parcelas serão cobradas automaticamente no seu Pix conforme o cronograma."
                  : "Estamos finalizando a configuração da sua mensalidade automática. Isso acontece em instantes após o pagamento da entrada."}
              </p>

              <div className="flex flex-wrap gap-2">
                <form
                  action={refreshRecurrence}
                  className="min-w-[140px] flex-1"
                >
                  <input
                    type="hidden"
                    name="enrollmentId"
                    value={enrollment.id}
                  />
                  <button
                    type="submit"
                    className="hover:bg-accent w-full rounded-xl border bg-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-95"
                  >
                    🔄 Atualizar Status
                  </button>
                </form>

                <Link
                  href="/admin/race"
                  className="min-w-[140px] flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-center text-xs font-bold text-white shadow-md shadow-gray-200 transition-all hover:bg-gray-800 active:scale-95"
                >
                  🏆 Ver Placar Geral
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-6">
            <Link
              href="/enroll"
              className="border-muted text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 group flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center text-sm font-bold transition-all"
            >
              <span>✨</span>
              Fazer nova inscrição para outra pessoa
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
