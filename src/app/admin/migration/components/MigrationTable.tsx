"use client";

import { useState } from "react";
import { Eye, QrCode, RefreshCw } from "lucide-react";

import { MigrationDetailsSheet } from "./MigrationDetailsSheet";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { MigrationData, RecurrenceWithMigration } from "@/types/migration";

export function MigrationTable({ data }: { data: RecurrenceWithMigration[] }) {
  const [loadingGenerate, setLoadingGenerate] = useState<string | null>(null);
  const [loadingSync, setLoadingSync] = useState<string | null>(null);
  const [selectedMigration, setSelectedMigration] =
    useState<MigrationData | null>(null);
  const { toast } = useToast();

  async function handleGenerateQR(id: string) {
    setLoadingGenerate(id);
    try {
      const res = await fetch("/api/admin/migration/generate-qr", {
        method: "POST",
        body: JSON.stringify({ recurrenceId: id }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Sucesso!", description: "QR Code Jornada 2 gerado." });
      window.location.reload();
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao gerar QR.",
      });
    } finally {
      setLoadingGenerate(null);
    }
  }

  async function handleSync(migrationId: string) {
    setLoadingSync(migrationId);
    try {
      const res = await fetch(`/api/admin/migration/sync`, {
        method: "POST",
        body: JSON.stringify({ migrationId }),
      });
      const resData = (await res.json()) as { status: string };

      if (resData.status === "CONSENT_ACCEPTED") {
        toast({
          title: "Aceite Confirmado!",
          description: "A recorrência foi ativada na J2.",
        });
      } else {
        toast({
          title: "Ainda Pendente",
          description: "O cliente ainda não autorizou.",
        });
      }
      window.location.reload();
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao sincronizar.",
      });
    } finally {
      setLoadingSync(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground border-b">
          <tr>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Contrato</th>
            <th className="px-4 py-3 font-medium">Jornada</th>
            <th className="px-4 py-3 font-medium">Status Migração</th>
            <th className="px-4 py-3 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center">
                Nenhum registro encontrado.
              </td>
            </tr>
          )}
          {data.map((item) => {
            const hasMigration = !!item.migration;
            const mStatus = item.migration?.status || "NOT_STARTED";
            return (
              <tr
                key={item.id}
                className="hover:bg-muted/50 border-b transition-colors last:border-0"
              >
                <td className="px-4 py-3 font-medium">
                  <div className="flex flex-col">
                    <span>{item.participant.fullName}</span>
                    <span className="text-muted-foreground text-[10px]">
                      {item.participant.phone}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">{item.contrato}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${item.jornada === "JORNADA_2" ? "border-green-200 bg-green-50 text-green-700" : "border-orange-200 bg-orange-50 text-orange-700"}`}
                  >
                    {item.jornada || "N/A"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                    {mStatus}
                  </span>
                </td>
                <td className="space-x-2 px-4 py-3 text-right">
                  {hasMigration && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedMigration(item.migration)}
                    >
                      <Eye className="mr-2 size-4" />
                      Histórico
                    </Button>
                  )}
                  {hasMigration &&
                    mStatus !== "CONSENT_ACCEPTED" &&
                    item.migration && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingSync === item.migration.id}
                        onClick={() =>
                          item.migration && handleSync(item.migration.id)
                        }
                      >
                        {loadingSync === item.migration.id ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </Button>
                    )}
                  {!hasMigration && (
                    <Button
                      size="sm"
                      disabled={loadingGenerate === item.id}
                      onClick={() => handleGenerateQR(item.id)}
                    >
                      {loadingGenerate === item.id ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <QrCode className="mr-2 size-4" />
                      )}
                      Gerar QR
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <MigrationDetailsSheet
        open={!!selectedMigration}
        onOpenChange={(open) => !open && setSelectedMigration(null)}
        migration={selectedMigration}
      />
    </div>
  );
}
