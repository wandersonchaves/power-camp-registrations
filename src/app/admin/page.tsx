import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          className="rounded-2xl border bg-white p-6 shadow-sm hover:bg-gray-50"
          href="/admin/race"
        >
          <div className="text-sm font-semibold">Placar (corrida até 50)</div>
          <div className="mt-1 text-xs text-gray-600">
            Águia vs Leão + marco dos 50 + prêmio
          </div>
        </Link>

        <Link
          className="rounded-2xl border bg-white p-6 shadow-sm hover:bg-gray-50"
          href="/admin/participants"
        >
          <div className="text-sm font-semibold">Participantes</div>
          <div className="mt-1 text-xs text-gray-600">
            Lista geral + busca por nome/CPF/TXID
          </div>
        </Link>
      </div>
    </div>
  );
}
