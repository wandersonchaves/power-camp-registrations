import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CalendarClock, CheckCircle2, Clock } from "lucide-react";

import { RetryChargeButton } from "./RetryChargeButton";

interface MonthlyCharge {
  txid: string | null;
  competencia: string | null;
  status: string;
  paidAt: Date | null;
  valorOriginal: string;
  politicaRetentativa: string | null;
  payload?: {
    encerramento?: {
      rejeicao?: {
        descricao?: string;
      };
    };
  } | null;
}

interface InstallmentItem {
  id: string;
  participantName: string;
  valorEquipe: string;
  initial: {
    status: string;
    paidAt: Date | null;
    amount: string;
  };
  monthlyCharges: MonthlyCharge[];
}

interface InstallmentTrackingProps {
  data: InstallmentItem[];
}

export function InstallmentTracking({ data }: InstallmentTrackingProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b bg-gray-50 px-6 py-4">
        <h2 className="font-semibold text-gray-800">
          Acompanhamento de Parcelas (Líderes)
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Visualização consolidada do Mês 1 (Inscrição) e meses seguintes
          (Recorrência Coletiva).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="px-6 py-3 font-bold text-gray-700">Líder</th>
              <th className="px-6 py-3 text-center font-bold text-gray-700">
                Mês 1 (Inscrição)
              </th>
              <th className="px-6 py-3 font-bold text-gray-700">
                Mensalidades Seguintes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((item) => (
              <tr
                key={item.id}
                className="transition-colors hover:bg-gray-50/50"
              >
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">
                    {item.participantName}
                  </div>
                  <div className="mt-1 text-xs italic text-gray-500">
                    Coletivo: R$ {item.valorEquipe}
                  </div>
                </td>

                <td className="px-6 py-4 text-center">
                  <StatusBadge
                    status={
                      item.initial.status === "CONFIRMED" ? "PAID" : "PENDING"
                    }
                    date={item.initial.paidAt}
                  />
                </td>

                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-3">
                    {item.monthlyCharges.length === 0 ? (
                      <span className="text-xs italic text-gray-400">
                        Nenhuma parcela gerada ainda
                      </span>
                    ) : (
                      item.monthlyCharges.map((charge) => (
                        <div
                          key={charge.competencia || "initial"}
                          className="flex min-w-[80px] flex-col items-center gap-1 rounded-lg border bg-gray-50 p-2"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-tight text-gray-500">
                            {charge.competencia}
                          </span>
                          <StatusBadge
                            status={
                              charge.status === "CONCLUIDA" ||
                              charge.status === "PAGO" ||
                              charge.status === "PAID"
                                ? "PAID"
                                : charge.status === "AGENDADA"
                                  ? "SCHEDULED"
                                  : charge.status === "EXPIRADA" ||
                                      charge.status === "REJEITADA"
                                    ? "EXPIRED"
                                    : "PENDING"
                            }
                            date={charge.paidAt}
                            size="sm"
                          />
                          {(charge.status === "EXPIRADA" ||
                            charge.status === "REJEITADA") && (
                            <div className="mt-1 flex flex-col gap-1">
                              <div className="text-[9px] font-bold uppercase text-rose-600">
                                {charge.status === "REJEITADA"
                                  ? "Rejeitado pela EFI"
                                  : charge.politicaRetentativa === "NAO_PERMITE"
                                    ? "Falha (Novo Pix Necessário)"
                                    : "Falha no Débito"}
                              </div>
                              {/* Motivo detalhado do JSON da EFI */}
                              {charge.payload?.encerramento?.rejeicao
                                ?.descricao && (
                                <div className="max-w-[100px] rounded border border-gray-100 bg-gray-50 p-1 text-[8px] leading-tight text-gray-500">
                                  {
                                    charge.payload.encerramento.rejeicao
                                      .descricao
                                  }
                                </div>
                              )}
                              {charge.txid &&
                                charge.status === "EXPIRADA" &&
                                charge.politicaRetentativa !==
                                  "NAO_PERMITE" && (
                                  <RetryChargeButton txid={charge.txid} />
                                )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  date,
  size = "md",
}: {
  status: "PAID" | "PENDING" | "SCHEDULED" | "EXPIRED";
  date?: Date | string | null;
  size?: "sm" | "md";
}) {
  const isPaid = status === "PAID";
  const isScheduled = status === "SCHEDULED";
  const isExpired = status === "EXPIRED";

  if (size === "sm") {
    return (
      <div
        title={
          isPaid && date
            ? `Pago em: ${format(new Date(date), "dd/MM/yyyy HH:mm")}`
            : isScheduled && date
              ? `Agendado para: ${format(new Date(date), "dd/MM/yyyy")}`
              : isExpired
                ? "Cobrança Expirada (Saldo insuficiente ou prazo vencido)"
                : "Pendente"
        }
      >
        {isPaid ? (
          <CheckCircle2 className="size-5 text-emerald-500" />
        ) : isScheduled ? (
          <CalendarClock className="size-5 text-blue-500" />
        ) : isExpired ? (
          <AlertCircle className="size-5 text-rose-500" />
        ) : (
          <Clock className="size-5 text-amber-500" />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
                          inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold
                          ${
                            isPaid
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : isScheduled
                                ? "border border-blue-200 bg-blue-50 text-blue-700"
                                : isExpired
                                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                                  : "border border-amber-200 bg-amber-50 text-amber-700"
                          }
                          `}
      >
        {isPaid ? (
          <CheckCircle2 className="size-3.5" />
        ) : isScheduled ? (
          <CalendarClock className="size-3.5" />
        ) : isExpired ? (
          <AlertCircle className="size-3.5" />
        ) : (
          <Clock className="size-3.5" />
        )}
        {isPaid
          ? "PAGO"
          : isScheduled
            ? "AGENDADO"
            : isExpired
              ? "EXPIRADO"
              : "PENDENTE"}
      </div>
      {(isPaid || isScheduled) && date && (
        <span className="text-[10px] text-gray-400">
          {format(new Date(date), "dd/MM/yy", { locale: ptBR })}
        </span>
      )}
    </div>
  );
}
