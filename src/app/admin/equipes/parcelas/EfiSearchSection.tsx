import {
  confirmManualWithEfiAction,
  registerEfiPaymentsAction,
} from "./actions";

import { formatCents } from "@/domain/team-installments/money";
import type { EfiSearchResult } from "@/use-cases/team-installments/search-efi-payments.use-case";

const inputCls = "rounded-md border border-gray-300 px-2 py-1 text-sm";
const btnCls =
  "rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700";

const paidAtLabel = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);

export function EfiSearchSection(props: {
  from: string;
  to: string;
  searched: boolean;
  result: EfiSearchResult | null;
  error: string | null;
}) {
  const { result } = props;
  const pending = result?.candidates.filter((c) => !c.registered) ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Buscar pagamentos na Efí</h2>
      <p className="text-sm text-gray-600">
        Consulta a Efí (somente leitura) e lista os Pix recebidos com valor
        igual a uma ou mais parcelas, com o responsável pelo pagamento. Registre
        os que faltam para ter a contagem real de parcelas pagas.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          De
          <input
            type="date"
            name="efiFrom"
            required
            defaultValue={props.from}
            className={`${inputCls} mt-1 block`}
          />
        </label>
        <label className="text-sm">
          Até
          <input
            type="date"
            name="efiTo"
            required
            defaultValue={props.to}
            className={`${inputCls} mt-1 block`}
          />
        </label>
        <button className={btnCls}>Buscar na Efí</button>
      </form>

      {props.error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          Não foi possível consultar a Efí: {props.error}
        </p>
      )}

      {result && result.truncated && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          O período é muito grande e a lista foi truncada. Reduza o intervalo
          para ver tudo.
        </p>
      )}

      {result && result.candidates.length === 0 && (
        <p className="text-sm text-gray-500">
          Nenhum Pix com valor de parcela nesse período.
        </p>
      )}

      {result && result.candidates.length > 0 && (
        <form action={registerEfiPaymentsAction} className="space-y-3">
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-2" />
                  <th className="p-2">Data</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2">Responsável</th>
                  <th className="p-2">Situação</th>
                  <th className="p-2">Equipe</th>
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((c) => (
                  <tr
                    key={c.endToEndId}
                    className={`border-t align-top ${c.registered ? "bg-gray-50 text-gray-500" : ""}`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        name="e2e"
                        value={c.endToEndId}
                        defaultChecked={!c.registered && !c.manualMatch}
                        disabled={Boolean(c.registered)}
                        aria-label={`Selecionar Pix ${c.endToEndId}`}
                      />
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {paidAtLabel(c.paidAt)}
                    </td>
                    <td className="whitespace-nowrap p-2">
                      {formatCents(c.amountCents)}
                      {c.installments > 1 && (
                        <div className="text-xs">{c.installments} parcelas</div>
                      )}
                    </td>
                    <td className="p-2">
                      {c.payerName ?? "—"}
                      {c.payerDocumentMasked && (
                        <div className="text-xs">{c.payerDocumentMasked}</div>
                      )}
                      <div className="text-xs">
                        {c.txid ? `txid ${c.txid.slice(0, 8)}…` : "Pix avulso"}
                      </div>
                    </td>
                    <td className="p-2">
                      {c.registered ? (
                        <span>
                          Já registrado ({c.registered.teamCode ?? "sem equipe"}
                          , {c.registered.status},{" "}
                          {c.registered.confirmation === "CONFIRMED"
                            ? "confirmado"
                            : "não confirmado"}
                          )
                        </span>
                      ) : (
                        <span className="font-medium text-green-800">
                          Novo na Efí
                        </span>
                      )}
                      {c.manualMatch && (
                        <div className="mt-1 text-xs text-amber-900">
                          Parece ser o lançamento manual
                          {c.manualMatch.teamCode
                            ? ` da equipe ${c.manualMatch.teamCode}`
                            : ""}
                          .{" "}
                          <button
                            formAction={confirmManualWithEfiAction}
                            name="confirm"
                            value={`${c.manualMatch.paymentId}|${c.endToEndId}`}
                            className="font-semibold underline"
                          >
                            Confirmar com este Pix
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {c.registered ? (
                        "—"
                      ) : (
                        <>
                          <select
                            name={`team_${c.endToEndId}`}
                            defaultValue={c.suggestedTeamCode ?? ""}
                            className={inputCls}
                            aria-label="Equipe"
                          >
                            <option value="">Definir depois</option>
                            <option value="AGUIA">Águia</option>
                            <option value="LEAO">Leão</option>
                          </select>
                          {c.suggestionReason && (
                            <div className="mt-1 text-xs text-gray-500">
                              {c.suggestionReason}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pending.length > 0 && (
            <button className={btnCls}>
              Registrar selecionados (confirmados pela Efí)
            </button>
          )}
        </form>
      )}
    </section>
  );
}
