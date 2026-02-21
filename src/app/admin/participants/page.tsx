import { EnrollmentsTable } from "../_components/EnrollmentsTable";
import { listEnrollments } from "../_data/admin.queries";

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ParticipantsPage(props: {
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

  const searchParams = await props.searchParams;

  const q = pickString(searchParams.q)?.trim() ?? "";
  const status = pickString(searchParams.status) as
    | "PENDING"
    | "CONFIRMED"
    | "CANCELLED"
    | undefined;

  const page = Number(pickString(searchParams.page) ?? "0");
  const pageSize = Number(pickString(searchParams.pageSize) ?? "50");

  const data = await listEnrollments({
    eventId,
    q: q || undefined,
    status,
    page,
    pageSize,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Participantes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Busque por nome, CPF ou TXID do pagamento inicial.
        </p>
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

        <input type="hidden" name="page" value="0" />
        <input type="hidden" name="pageSize" value={String(pageSize)} />

        <button
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          type="submit"
        >
          Filtrar
        </button>
      </form>

      <EnrollmentsTable items={data.items} />

      <div className="flex items-center justify-between text-sm text-gray-700">
        <div>
          Total: <span className="font-semibold">{data.total}</span>
        </div>

        <div className="flex items-center gap-2">
          <a
            className={`rounded-xl border px-3 py-2 ${data.page <= 0 ? "pointer-events-none opacity-50" : "hover:bg-gray-50"}`}
            href={`?q=${encodeURIComponent(q)}&status=${status ?? ""}&page=${Math.max(0, data.page - 1)}&pageSize=${data.pageSize}`}
          >
            Anterior
          </a>

          <span className="text-xs text-gray-600">Página {data.page + 1}</span>

          <a
            className={`rounded-xl border px-3 py-2 ${
              (data.page + 1) * data.pageSize >= data.total
                ? "pointer-events-none opacity-50"
                : "hover:bg-gray-50"
            }`}
            href={`?q=${encodeURIComponent(q)}&status=${status ?? ""}&page=${data.page + 1}&pageSize=${data.pageSize}`}
          >
            Próxima
          </a>
        </div>
      </div>
    </div>
  );
}
