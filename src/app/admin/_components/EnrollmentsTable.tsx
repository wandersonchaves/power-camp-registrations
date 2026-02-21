import type { EnrollmentRow } from "../_data/admin.types";

function fmtDate(d: Date | null) {
  if (!d) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function EnrollmentsTable(props: { items: EnrollmentRow[] }) {
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
              <th className="px-4 py-3 text-left">TXID</th>
              <th className="px-4 py-3 text-left">Confirmado em</th>
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
                <td className="px-4 py-3 font-mono text-xs">
                  {r.initialPayment?.txid ?? "-"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">
                  {fmtDate(r.confirmedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
