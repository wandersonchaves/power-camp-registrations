import type { TeamCode } from "@prisma/client";

import { EnrollmentsTable } from "../../_components/EnrollmentsTable";
import { Progress50 } from "../../_components/Progress50";
import { StatCard } from "../../_components/StatCard";
import { listEnrollments } from "../../_data/admin.queries";

type Params = { teamCode: TeamCode };
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

  const teamCode = params.teamCode;

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {teamCode === "AGUIA" ? "Equipe Águia" : "Equipe Leão"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Controle por equipe (até 50 confirmados).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Confirmados"
          value={String(confirmed)}
          subtitle={`${pending} pendentes`}
          right={<Progress50 confirmed={confirmed} />}
        />
        <StatCard
          title="Total na lista"
          value={String(data.total)}
          subtitle="considerando filtros"
        />
      </div>

      <form
        className="flex flex-wrap gap-2 rounded-2xl border bg-white p-4 shadow-sm"
        method="GET"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar (nome, CPF, TXID)..."
          className="w-72 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
        />

        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Todos</option>
          <option value="PENDING">PENDING</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        <button
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          type="submit"
        >
          Filtrar
        </button>
      </form>

      <EnrollmentsTable items={data.items} />
    </div>
  );
}
