"use client";

import { useState } from "react";
import { AlertCircle, Eye, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";

interface PreviewItem {
  id: string;
  name: string;
  cpf: string;
  value: string;
}

export function RunBatchButton({
  teamCode,
  competencia,
}: {
  teamCode?: "AGUIA" | "LEAO";
  competencia: string;
}) {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewItem[]>([]);

  const router = useRouter();
  const { toast } = useToast();

  async function handlePreview() {
    setPreviewLoading(true);
    try {
      const resp = await fetch("/api/admin/pix-auto/preview-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCode, targetCompetencia: competencia }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Erro ao carregar preview");

      setPreviewData(data.items);
      setIsPreviewOpen(true);
    } catch (err) {
      toast({
        title: "Erro no preview",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRun() {
    setIsPreviewOpen(false);
    setLoading(true);
    try {
      const resp = await fetch("/api/admin/pix-auto/run-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCode, targetCompetencia: competencia }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Erro ao rodar batch");

      if (data.failed > 0) {
        interface BatchDetail {
          status: string;
          error?: string;
        }
        data.details
          .filter((d: BatchDetail) => d.status === "failed")
          .forEach((d: BatchDetail) => {
            let friendlyError = d.error || "Erro desconhecido";
            if (friendlyError.includes("txid encontra-se em uso")) {
              friendlyError =
                "O código desta cobrança já foi usado. Tente rodar novamente para gerar um novo ID.";
            }

            toast({
              title: "Falha na cobrança",
              description: friendlyError,
              variant: "destructive",
            });
          });
      }

      toast({
        title: "Batch executado",
        description: `Sucesso: ${data.success}. Falhas: ${data.failed}.`,
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
    <>
      <div className="flex flex-col gap-2">
        <Button
          onClick={handlePreview}
          disabled={loading || previewLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          {previewLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Eye className="size-4" />
          )}
          Visualizar Lançamentos
        </Button>

        <Button
          onClick={handleRun}
          disabled={loading || previewLoading}
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
      </div>

      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <Eye className="size-5 text-blue-600" />
            <h3 className="text-lg font-bold">
              Confirmar Lançamentos - {competencia}
            </h3>
          </div>

          {previewData.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertCircle className="size-12 text-amber-500" />
              <p className="font-semibold text-gray-700">
                Nenhum lançamento pendente encontrado.
              </p>
              <p className="text-sm text-gray-500">
                Todas as recorrências ativas já possuem cobranças para esta
                competência ou não há recorrências válidas.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                As seguintes cobranças serão geradas na Efí para a competência{" "}
                <strong>{competencia}</strong>:
              </p>

              <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 font-bold">Participante</th>
                      <th className="px-4 py-2 font-bold">CPF</th>
                      <th className="px-4 py-2 text-right font-bold">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewData.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {item.cpf}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          R$ {Number(item.value).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="text-sm font-bold">
                  Total: {previewData.length} item(s)
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setIsPreviewOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleRun} disabled={loading}>
                    {loading && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Confirmar e Gerar Cobranças
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
