// src/app/enroll/success/page.tsx
import Link from "next/link";

import { AutoRefreshPayment } from "./_components/AutoRefreshPayment.client";
import { PixCopyPaste } from "./_components/PixCopyPaste.client";

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

/**
 * Converte string de dinheiro (915.00 ou 915,00) em número corretamente.
 */
function moneyToNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    let s = v.trim();
    // Se tiver vírgula e ponto (ex: 1.250,00), remove ponto e troca vírgula por ponto
    if (s.includes(",") && s.includes(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    }
    // Se tiver apenas vírgula (ex: 915,00), troca por ponto
    else if (s.includes(",")) {
      s = s.replace(",", ".");
    }
    // Se for apenas número com ponto (ex: 915.00), mantém como está

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

export default async function EnrollSuccessPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const enrollmentId = pickString(searchParams.enrollmentId) ?? "";

  if (!enrollmentId)
    return (
      <div className="p-10 text-center font-sans font-bold">
        Inscrição não encontrada.
      </div>
    );

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      status: true,
      eventId: true,
      participantId: true,
      team: { select: { id: true, name: true, code: true } },
      participant: { select: { fullName: true } },
      initialPayment: {
        select: { paidAt: true, amount: true, payload: true, txid: true },
      },
    },
  });

  if (!enrollment)
    return (
      <div className="p-10 text-center font-sans font-bold">
        Inscrição não encontrada.
      </div>
    );

  const myRecurrence = await prisma.pixAutoRecurrence.findFirst({
    where: {
      participantId: enrollment.participantId,
      eventId: enrollment.eventId,
      status: { in: ["CRIADA", "ATIVA", "APROVADA"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const teamRecurrence = enrollment.team
    ? await prisma.pixAutoRecurrence.findFirst({
        where: {
          eventId: enrollment.eventId,
          participant: {
            enrollments: {
              some: {
                teamId: enrollment.team.id,
                status: { in: ["PENDING", "CONFIRMED"] },
              },
            },
          },
          status: { in: ["CRIADA", "ATIVA", "APROVADA"] },
        },
        include: { participant: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const hasMyOwnRecurrence = !!myRecurrence;
  const isTeamRecurrenceActive =
    teamRecurrence?.status === "ATIVA" || teamRecurrence?.status === "APROVADA";
  const isPaidEntrance = Boolean(enrollment.initialPayment?.paidAt);
  const teamCode = enrollment.team?.code as TeamCode | undefined;

  return (
    <main className="min-h-screen bg-gray-50 pb-20 font-sans text-gray-900">
      {teamCode && (
        <div
          className={cn("mb-[-64px] h-32 w-full", getTeamGradient(teamCode))}
        />
      )}

      <div className="mx-auto max-w-xl space-y-4 px-4 pt-10">
        <div className="relative overflow-hidden rounded-3xl border bg-white p-8 shadow-2xl">
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
              {isPaidEntrance ? "Inscrição Confirmada!" : "Inscrição Gerada!"}
            </h1>
            <p className="text-muted-foreground mt-1 text-balance text-sm font-medium italic">
              Arena {enrollment.team?.name || "PowerCamp"}.
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid gap-1 border-b pb-4">
              <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                Participante
              </span>
              <span className="text-xl font-black">
                {enrollment.participant.fullName}
              </span>
            </div>

            {/* Status da Entrada */}
            <div
              className={cn(
                "flex items-center justify-between rounded-2xl border p-4 shadow-sm transition-all",
                isPaidEntrance
                  ? "border-green-100 bg-green-50"
                  : "border-amber-100 bg-amber-50",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{isPaidEntrance ? "✅" : "⏳"}</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-tight text-gray-800">
                    Entrada Individual
                  </p>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isPaidEntrance ? "text-green-700" : "text-amber-700",
                    )}
                  >
                    {isPaidEntrance
                      ? "Pagamento Confirmado"
                      : "Aguardando Pix de Entrada"}
                  </p>
                </div>
              </div>
              {!isPaidEntrance && (
                <span className="rounded bg-amber-200 px-2 py-1 text-xs font-bold text-amber-800">
                  PENDENTE
                </span>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-muted-foreground border-primary border-l-2 pl-2 text-[10px] font-bold uppercase tracking-widest">
                Recorrência Coletiva (Equipe)
              </h3>

              {hasMyOwnRecurrence ? (
                <div
                  className={cn(
                    "rounded-2xl border-2 p-6 shadow-md transition-all",
                    isTeamRecurrenceActive
                      ? "border-green-200 bg-green-50"
                      : "bg-primary/5 border-primary/20",
                  )}
                >
                  <div className="mb-6 flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm">
                    <span className="text-3xl">🚀</span>
                    <div>
                      <p className="text-primary text-balance font-sans text-sm font-black uppercase leading-none tracking-tight">
                        Você é o Responsável Financeiro
                      </p>
                      <p className="text-muted-foreground mt-1 text-[10px] font-bold uppercase">
                        Autorizando mensalidade de 50 pessoas
                      </p>
                    </div>
                  </div>

                  {!isTeamRecurrenceActive ? (
                    <div className="space-y-6 text-center">
                      <div className="inline-block w-full rounded-2xl border-2 border-dashed bg-white p-5 shadow-inner">
                        <p className="text-muted-foreground mb-1 text-[10px] font-bold uppercase">
                          Total Mensal do Grupo (50x)
                        </p>
                        <p className="text-primary font-sans text-4xl font-black tracking-tighter">
                          {formatBRL(myRecurrence?.valorRec)}
                        </p>
                      </div>
                      <div className="flex flex-col items-center py-2">
                        <PixQr
                          value={myRecurrence?.pixCopiaECola || ""}
                          title="Ativar Equipe Agora"
                        />
                      </div>
                      <div className="space-y-4">
                        <PixCopyPaste
                          value={myRecurrence?.pixCopiaECola || ""}
                          label="Copia e Cola Coletivo"
                        />
                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
                          <p className="text-[11px] font-bold leading-relaxed text-amber-800">
                            ⚠️ Este Pix ativa o pagamento automático de toda a
                            sua equipe. Escaneie apenas uma vez.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center">
                      <div className="mb-3 text-5xl">🎉</div>
                      <p className="font-sans text-lg font-black uppercase text-green-800">
                        Equipe Ativada!
                      </p>
                      <p className="text-sm font-medium text-green-700">
                        As mensalidades automáticas estão configuradas com
                        sucesso.
                      </p>
                    </div>
                  )}
                </div>
              ) : teamRecurrence ? (
                <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/50 p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-3xl">👥</span>
                    <div>
                      <p className="font-sans text-sm font-black uppercase leading-none tracking-tight text-blue-900">
                        Pagamento Centralizado
                      </p>
                      <p className="mt-1 text-balance text-xs font-medium italic text-blue-700">
                        Sua vaga está coberta pelo responsável da equipe
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-white/80 p-4 shadow-sm">
                    <p className="mb-1 text-[10px] font-bold uppercase text-blue-600">
                      Líder Atual
                    </p>
                    <p className="font-sans text-lg font-black text-blue-900">
                      {teamRecurrence?.participant?.fullName}
                    </p>
                  </div>
                  <p className="mt-5 rounded-lg border border-blue-100/50 bg-white/40 p-2 text-[11px] font-medium italic leading-relaxed text-blue-800">
                    {isTeamRecurrenceActive
                      ? "✅ Plano ativo. Suas mensalidades serão cobradas via líder."
                      : "⏳ Aguardando ativação final pelo líder acima."}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-10 text-center font-medium italic text-gray-400">
                  Aguardando definição do Líder da Equipe...
                </div>
              )}
            </div>
          </div>

          <AutoRefreshPayment
            enrollmentId={enrollment.id}
            enabled={!isTeamRecurrenceActive || !isPaidEntrance}
          />

          <div className="mt-10 flex flex-col gap-3 border-t pt-6">
            <Link
              href="/admin/race"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 p-4 text-center font-sans text-sm font-bold text-white shadow-xl transition-all hover:bg-gray-800 active:scale-95"
            >
              🏆 Ver Placar e Ranking
            </Link>
            <Link
              href="/enroll"
              className="text-muted-foreground hover:text-primary py-2 text-center font-sans text-xs font-bold uppercase tracking-widest underline-offset-4 transition-colors hover:underline"
            >
              ✨ Fazer outra inscrição
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
