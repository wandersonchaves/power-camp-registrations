"use client";

import { useState } from "react";
import { Copy, Loader2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  recurrenceId: string;
  competencia: string;
  participantName: string;
}

export function AdhocCobButton({
  recurrenceId,
  competencia,
  participantName,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{
    pixCopiaECola?: string;
    qrcode?: string;
  } | null>(null);

  const { toast } = useToast();

  async function handleCreate() {
    setLoading(true);
    try {
      const resp = await fetch("/api/admin/pix-auto/create-adhoc-cob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurrenceId, competencia }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Erro ao gerar cobrança");

      // A resposta do createAdhoc... retorna o modelo PixCobImmediate.
      // O payload contém os dados da Efí (incluindo loc/qrcode)
      const efiData = data.payload;
      setQrCodeData({
        pixCopiaECola: efiData?.pixCopiaECola,
        qrcode: efiData?.qrcode || efiData?.pixCopiaECola, // Se não tiver imagem, usamos o copia e cola
      });
      setIsOpen(true);

      toast({
        title: "Sucesso!",
        description: "Cobrança Pix Imediata gerada com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro ao gerar Pix",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (qrCodeData?.pixCopiaECola) {
      navigator.clipboard.writeText(qrCodeData.pixCopiaECola);
      toast({
        title: "Copiado!",
        description: "Código Pix copiado para a área de transferência.",
      });
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        onClick={handleCreate}
        disabled={loading}
        className="h-7 gap-1 px-2 text-[10px] font-bold text-amber-600 hover:bg-amber-50 hover:text-amber-700"
      >
        {loading ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <QrCode className="size-3" />
        )}
        GERAR PIX AVULSO
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-1">
            <h3 className="text-lg font-bold">Pix Avulso - {competencia}</h3>
            <p className="text-sm text-gray-500">{participantName}</p>
          </div>

          <p className="text-xs text-amber-600">
            Esta é uma cobrança imediata (válida por 7 dias) para suprir a
            mensalidade deste mês.
          </p>

          {qrCodeData?.pixCopiaECola && (
            <div className="flex w-full flex-col gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 p-4">
                {/* Aqui idealmente usaria um componente de QR Code real se houvesse, 
                     mas vamos exibir o código para cópia por enquanto */}
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
                  <Copy className="size-3" /> PIX COPIA E COLA
                </div>
                <div className="max-h-32 w-full overflow-y-auto break-all rounded border border-gray-200 bg-white p-3 text-left font-mono text-[10px] text-gray-600">
                  {qrCodeData.pixCopiaECola}
                </div>
              </div>

              <Button onClick={copyToClipboard} className="w-full gap-2">
                <Copy className="size-4" />
                Copiar Código Pix
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="w-full"
          >
            Fechar
          </Button>
        </div>
      </Modal>
    </>
  );
}
