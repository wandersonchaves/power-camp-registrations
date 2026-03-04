export function StatsCards({
  stats,
}: {
  stats: { status: string; _count: number }[];
}) {
  const total = stats.reduce((acc, curr) => acc + curr._count, 0);
  const accepted =
    stats.find((s) => s.status === "CONSENT_ACCEPTED")?._count || 0;
  const pending = total - accepted;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="bg-card text-card-foreground rounded-xl border p-6 shadow">
        <h3 className="text-sm font-medium">Total Migrações</h3>
        <div className="mt-2 text-2xl font-bold">{total}</div>
      </div>
      <div className="bg-card text-card-foreground rounded-xl border p-6 shadow">
        <h3 className="text-sm font-medium">Aceitas (J2 Ativa)</h3>
        <div className="mt-2 text-2xl font-bold text-green-600">{accepted}</div>
      </div>
      <div className="bg-card text-card-foreground rounded-xl border p-6 shadow">
        <h3 className="text-sm font-medium">Pendentes/Erro</h3>
        <div className="mt-2 text-2xl font-bold text-yellow-600">{pending}</div>
      </div>
    </div>
  );
}
