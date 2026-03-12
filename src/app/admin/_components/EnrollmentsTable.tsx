"use client";

import { useState, useTransition } from "react";
import { Crown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { setTeamLeaderAction } from "../_actions/set-team-leader";
import type { EnrollmentRow } from "../_data/admin.types";

function fmtDate(d: Date | null) {
  if (!d) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function EnrollmentsTable(props: { items: EnrollmentRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSetLeader = (enrollmentId: string) => {
    if (
      !confirm(
        "Tem certeza que deseja definir este participante como LÍDER FINANCEIRO da equipe? Isso cancelará qualquer QR Code anterior da equipe.",
      )
    )
      return;

    setLoadingId(enrollmentId);
    startTransition(async () => {
      try {
        const res = await setTeamLeaderAction(enrollmentId);
        if (res.success) {
          router.push(res.url);
        }
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Erro desconhecido";
        alert("Erro ao definir líder: " + errorMsg);
      } finally {
        setLoadingId(null);
      }
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">Participante</th>
              <th className="px-4 py-3 text-left">Equipe</th>
              <th className="px-4 py-3 text-left">Inscrição</th>
              <th className="px-4 py-3 text-left">Pagamento inicial</th>
              <th className="px-4 py-3 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {props.items.map((r) => (
              <tr key={r.enrollmentId} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.participantName}</div>
                  <div className="text-xs text-gray-600">
                    CPF: {r.participantCpf}
                  </div>
                </td>
                <td className="px-4 py-3">{r.teamName}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border px-2 py-1 text-xs">
                    {r.status}
                  </span>
                  <div className="mt-1 text-xs text-gray-600">
                    Reservado: {fmtDate(r.reservedAt)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.initialPayment ? (
                    <>
                      <span className="rounded-full border px-2 py-1 text-xs">
                        {r.initialPayment.status}
                      </span>
                      <div className="mt-1 text-xs text-gray-600">
                        R$ {r.initialPayment.amount}
                      </div>
                      <div className="text-xs text-gray-600">
                        Pago: {fmtDate(r.initialPayment.paidAt)}
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.teamName &&
                    r.teamName !== "-" &&
                    r.status === "CONFIRMED" && (
                      <button
                        onClick={() => handleSetLeader(r.enrollmentId)}
                        disabled={isPending}
                        className="flex items-center gap-1 rounded-lg border bg-amber-50 px-2 py-1.5 font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                      >
                        {loadingId === r.enrollmentId ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Crown className="size-3" />
                        )}
                        Tornar Líder
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
