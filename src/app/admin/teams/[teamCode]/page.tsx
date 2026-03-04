import type { TeamCode as PrismaTeamCode } from "@prisma/client";

import { EnrollmentsTable } from "../../_components/EnrollmentsTable";
import { Progress50 } from "../../_components/Progress50";
import { listEnrollments } from "../../_data/admin.queries";

import { TeamBadge } from "@/components/teams/team-badge";
import { TeamCard } from "@/components/teams/team-card";
import { cn } from "@/lib/utils";
import { TeamCode } from "@/theme/team-config";
import { getTeamDisplayName } from "@/theme/team-styles";

type Params = { teamCode: PrismaTeamCode };
type SearchParams = Record<string, string | string[] | undefined>;

function pickString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function TeamPage(props: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const eventId = process.env.POWERCAMP_EVENT_ID ?? "";
  if (!eventId) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="text-sm font-semibold">Falta configurar</div>
        <div className="mt-2 text-sm text-gray-700">
          Defina <span className="font-mono text-xs">POWERCAMP_EVENT_ID</span>{" "}
          no .env
        </div>
      </div>
    );
  }

  const params = await props.params;
  const searchParams = await props.searchParams;

  const teamCode = params.teamCode as TeamCode;

  const q = pickString(searchParams.q)?.trim() ?? "";
  const status = pickString(searchParams.status) as
    | "PENDING"
    | "CONFIRMED"
    | "CANCELLED"
    | undefined;

  const data = await listEnrollments({
    eventId,
    teamCode,
    q: q || undefined,
    status,
    page: 0,
    pageSize: 200,
  });

  const confirmed = data.items.filter((i) => i.status === "CONFIRMED").length;
  const pending = data.items.filter((i) => i.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2">
            <TeamBadge team={teamCode} className="text-sm" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            {getTeamDisplayName(teamCode)}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gestão estratégica e monitoramento de performance da equipe.
          </p>
        </div>

        <div className="text-muted-foreground bg-muted flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest">
          Meta: 50 Confirmados
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <TeamCard
          team={teamCode}
          title="Confirmados"
          subtitle={`${pending} pendentes na fila`}
          gradient
        >
          <div className="flex items-center justify-between">
            <span className="text-4xl font-bold">{confirmed}</span>
            <div className="w-32">
              <Progress50 confirmed={confirmed} />
            </div>
          </div>
        </TeamCard>

        <TeamCard
          team={teamCode}
          title="Total Inscritos"
          subtitle="Base total da equipe (todos os status)"
        >
          <span className="text-4xl font-bold">{data.total}</span>
        </TeamCard>
      </div>

      <form
        className="bg-card flex flex-wrap gap-3 rounded-2xl border p-5 shadow-sm"
        method="GET"
      >
        <div className="min-w-[280px] flex-1">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CPF ou TXID..."
            className={cn(
              "bg-background w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all focus:ring-2",
              teamCode === "AGUIA"
                ? "border-blue-100 focus:ring-blue-500"
                : "border-red-100 focus:ring-red-500",
            )}
          />
        </div>

        <select
          name="status"
          defaultValue={status ?? ""}
          className="bg-background rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-200"
        >
          <option value="">Todos os Status</option>
          <option value="PENDING">PENDENTE</option>
          <option value="CONFIRMED">CONFIRMADO</option>
          <option value="CANCELLED">CANCELADO</option>
        </select>

        <button
          className={cn(
            "rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]",
            teamCode === "AGUIA"
              ? "bg-blue-600 shadow-lg shadow-blue-100 hover:bg-blue-700"
              : "bg-red-600 shadow-lg shadow-red-100 hover:bg-red-700",
          )}
          type="submit"
        >
          Filtrar Lista
        </button>
      </form>

      <div className="bg-card overflow-hidden rounded-2xl border shadow-sm">
        <EnrollmentsTable items={data.items} />
      </div>
    </div>
  );
}
