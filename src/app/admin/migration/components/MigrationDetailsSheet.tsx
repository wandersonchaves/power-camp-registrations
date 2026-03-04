"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MigrationAuditLog, MigrationData } from "@/types/migration";

export function MigrationDetailsSheet({
  open,
  onOpenChange,
  migration,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  migration: MigrationData | null;
}) {
  if (!migration) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Histórico de Migração</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                Status Atual
              </p>
              <Badge className="mt-1">{migration.status}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase">
                Tentativas
              </p>
              <p className="text-lg font-bold">{migration.attempts}</p>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase">
              Linha do Tempo
            </p>
            <div className="border-muted ml-2 space-y-4 border-l-2 pl-4">
              {(migration.auditLogs || [])
                .sort(
                  (a: MigrationAuditLog, b: MigrationAuditLog) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
                )
                .map((log: MigrationAuditLog) => (
                  <div key={log.id} className="relative">
                    <div className="bg-primary absolute left-[25px] top-1 size-3 rounded-full" />
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", {
                        locale: ptBR,
                      })}
                    </p>
                    {log.payload && (
                      <pre className="bg-muted mt-2 overflow-x-auto rounded p-2 text-[10px]">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}

              <div className="relative">
                <div className="bg-muted absolute left-[25px] top-1 size-3 rounded-full" />
                <p className="text-sm font-medium">Início do Processo</p>
                <p className="text-muted-foreground text-xs">
                  {format(
                    new Date(migration.createdAt),
                    "dd/MM/yyyy HH:mm:ss",
                    { locale: ptBR },
                  )}
                </p>
              </div>
            </div>
          </div>

          {migration.lastError && (
            <div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
              <p className="text-destructive text-xs font-bold uppercase">
                Último Erro
              </p>
              <p className="mt-1 text-sm">
                {typeof migration.lastError === "string"
                  ? migration.lastError
                  : (migration.lastError as { message?: string }).message ||
                    "Erro desconhecido"}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
