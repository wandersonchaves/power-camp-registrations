import { MigrationTable } from "./components/MigrationTable";
import { StatsCards } from "./components/StatsCards";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MigrationAdminPage() {
  const stats = await prisma.pixAutoMigration.groupBy({
    by: ["status"],
    _count: true,
  });

  const candidates = await prisma.pixAutoRecurrence.findMany({
    where: {
      migration: {
        OR: [{ status: { not: "CONSENT_ACCEPTED" } }],
      },
      status: { notIn: ["CANCELADA", "CANCELLED"] },
    },
    include: {
      participant: true,
      migration: {
        include: {
          auditLogs: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Se a lista acima vier vazia (porque não existem registros na tabela PixAutoMigration ainda),
  // buscamos todos que não tem NENHUMA migração iniciada.
  let finalCandidates = candidates;
  if (candidates.length === 0) {
    finalCandidates = await prisma.pixAutoRecurrence.findMany({
      where: {
        migration: null,
        status: { notIn: ["CANCELADA", "CANCELLED"] },
      },
      include: {
        participant: true,
        migration: {
          include: {
            auditLogs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">
          Migração Pix Automático (J3 → J2)
        </h1>
        <p className="text-muted-foreground mt-2">
          Converta clientes para o fluxo nativo da Efí.
        </p>
      </div>

      <StatsCards stats={stats} />

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Clientes Pendentes ({finalCandidates.length})
          </h2>
        </div>

        <MigrationTable data={finalCandidates} />
      </div>
    </div>
  );
}
