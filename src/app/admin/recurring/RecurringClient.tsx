"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function RunBatchButton({
  teamCode,
  competencia,
}: {
  teamCode?: "AGUIA" | "LEAO";
  competencia: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function handleRun() {
    if (
      !confirm(
        `Deseja realmente gerar as cobranças de ${competencia}${teamCode ? ` para a equipe ${teamCode}` : ""}?`,
      )
    )
      return;

    setLoading(true);
    try {
      const resp = await fetch("/api/admin/pix-auto/run-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCode, targetCompetencia: competencia }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Erro ao rodar batch");

      toast({
        title: "Batch executado com sucesso",
        description: `Geradas ${data.success} cobranças. Falhas: ${data.failed}.`,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Erro ao executar batch",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleRun}
      disabled={loading}
      variant={
        teamCode === "AGUIA"
          ? "default"
          : teamCode === "LEAO"
            ? "destructive"
            : "outline"
      }
      className="flex items-center gap-2"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Play className="size-4" />
      )}
      {teamCode ? `Rodar para ${teamCode}` : "Rodar para Todos"}
    </Button>
  );
}
