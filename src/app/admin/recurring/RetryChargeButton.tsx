"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { Loader2, RefreshCcw } from "lucide-react";

import { useToast } from "@/components/ui/use-toast";

interface RetryChargeButtonProps {
  txid: string;
}

export function RetryChargeButton({ txid }: RetryChargeButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleRetry() {
    if (!confirm("Deseja solicitar uma nova tentativa de débito para amanhã?"))
      return;

    setLoading(true);
    try {
      // Data sugerida para a retentativa: amanhã
      const nextDate = format(addDays(new Date(), 1), "yyyy-MM-dd");

      const response = await fetch(`/api/pix-auto/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txid, date: nextDate }),
      });

      if (!response.ok) throw new Error("Falha ao solicitar retentativa");

      toast({
        title: "Sucesso!",
        description: "Retentativa solicitada com sucesso!",
      });
      // Recarrega a página para atualizar o status
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao solicitar retentativa na EFI.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
      title="Solicitar nova tentativa de débito"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <RefreshCcw className="size-3" />
      )}
      RETENTAR
    </button>
  );
}
