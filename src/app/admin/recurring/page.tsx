import { format } from "date-fns";

import { getRecurringSummary } from "../_data/admin.queries";
import { RunBatchButton } from "./RecurringClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const eventId = process.env.POWERCAMP_EVENT_ID ?? "";

  // Competência padrão é o MÊS ATUAL (conforme regra do dia 20)
  const now = new Date();
  const defaultCompetencia = format(now, "yyyy-MM");

  // Sugestão de vencimento (mínimo D+2 da Efí se for gerar hoje)
  const suggestedDay = Math.max(now.getDate() + 2, 22);

  const summary = await getRecurringSummary({ eventId });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pagamentos Recorrentes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Gerencie a geração manual de cobranças PIX Recorrência para os Líderes
          de Equipe.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {summary.map((s) => (
          <div
            key={s.teamCode}
            className="rounded-2xl border bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{s.teamName}</div>
                <div className="mt-1 text-3xl font-bold">{s.activeCount}</div>
                <div className="text-xs text-gray-500">Líder Pagador Ativo</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Valor da Equipe
                </div>
                <div className="text-lg font-semibold text-gray-700">
                  R$ {s.totalMonthlyValue}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <RunBatchButton
                teamCode={s.teamCode as "AGUIA" | "LEAO"}
                competencia={defaultCompetencia}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-gray-50 p-6">
        <div className="text-sm font-semibold">Ações Globais</div>
        <p className="mb-4 mt-1 text-xs text-gray-600">
          Gera cobranças para todos os líderes com recorrência ativa.
        </p>
        <RunBatchButton competencia={defaultCompetencia} />
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Informações Importantes</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
          <li>
            As cobranças são geradas para a competência{" "}
            <strong>{defaultCompetencia}</strong> (Mês Atual).
          </li>
          <li>
            Data de vencimento calculada automaticamente para garantir aceitação
            (mínimo D+2):{" "}
            <strong>
              {suggestedDay}/{format(now, "MM")}
            </strong>
            .
          </li>
          <li>
            Somente os líderes de cada equipe (pagamento coletivo) possuem
            recorrência ativa com o valor de R$ 933,30.
          </li>
          <li>
            O sistema evita duplicidade: se o líder já tiver uma cobrança gerada
            para {defaultCompetencia}, o processo o pulará.
          </li>
        </ul>
      </div>
    </div>
  );
}
