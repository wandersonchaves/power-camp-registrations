import Link from "next/link";

import {
  assignPaymentAction,
  createManualPaymentAction,
  promotePaymentAction,
} from "./actions";

import type { CellState } from "@/domain/team-installments/installment-matrix";
import { formatCents } from "@/domain/team-installments/money";
import { getTeamInstallmentConfig } from "@/infra/team-installments/config";
import { getTeamInstallments } from "@/infra/team-installments/container";
import { requireAdmin } from "@/lib/auth/guards";
import type { PaymentView } from "@/use-cases/team-installments/get-installment-overview.use-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const CELL: Record<CellState, { label: string; className: string }> = {
  PAID: { label: "PAGO", className: "bg-green-100 text-green-800" },
  PAID_UNCONFIRMED: {
    label: "PAGO NÃO CONFIRMADO",
    className: "bg-amber-100 text-amber-900 ring-1 ring-amber-400",
  },
  OVERDUE: { label: "ABERTO", className: "bg-red-100 text-red-800" },
  UPCOMING: { label: "A VENCER", className: "bg-gray-100 text-gray-600" },
};

const dueLabel = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")}/${MONTHS[d.getUTCMonth()]}`;

const paidAtLabel = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);

const inputCls = "rounded-md border border-gray-300 px-2 py-1 text-sm";
const btnCls =
  "rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700";

function TeamSelect() {
  return (
    <select name="team" required className={inputCls} defaultValue="">
      <option value="" disabled>
        Equipe…
      </option>
      <option value="AGUIA">Águia</option>
      <option value="LEAO">Leão</option>
    </select>
  );
}

function PaymentsTable(props: {
  rows: PaymentView[];
  action?: "assign" | "promote";
  empty: string;
}) {
  if (props.rows.length === 0) {
    return <p className="text-sm text-gray-500">{props.empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="p-2">Data</th>
            <th className="p-2">Valor</th>
            <th className="p-2">Pagador</th>
            <th className="p-2">Origem</th>
            <th className="p-2">Equipe</th>
            <th className="p-2">Motivo / nota</th>
            {props.action && <th className="p-2">Ação</th>}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((p) => (
            <tr key={p.id} className="border-t align-top">
              <td className="whitespace-nowrap p-2">{paidAtLabel(p.paidAt)}</td>
              <td className="whitespace-nowrap p-2">
                {formatCents(p.amountCents)}
              </td>
              <td className="p-2">
                {p.payerName ?? "—"}
                {p.payerDocumentMasked && (
                  <div className="text-xs text-gray-500">
                    {p.payerDocumentMasked}
                  </div>
                )}
              </td>
              <td className="p-2">
                {p.source}
                <div className="text-xs text-gray-500">{p.status}</div>
              </td>
              <td className="p-2">{p.teamCode ?? "—"}</td>
              <td className="p-2 text-xs text-gray-600">
                {[p.attributionReason, p.note].filter(Boolean).join(" · ") ||
                  "—"}
              </td>
              {props.action === "assign" && (
                <td className="p-2">
                  <form
                    action={assignPaymentAction}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="paymentId" value={p.id} />
                    <TeamSelect />
                    {p.payerName && (
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" name="saveAlias" /> salvar nome
                        como alias
                      </label>
                    )}
                    <button className={btnCls}>Atribuir</button>
                  </form>
                </td>
              )}
              {props.action === "promote" && (
                <td className="p-2">
                  {p.source === "MANUAL" ? (
                    <form
                      action={promotePaymentAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input
                        name="realEndToEndId"
                        required
                        minLength={10}
                        placeholder="e2eId real (E…)"
                        className={`${inputCls} w-56`}
                      />
                      <button className={btnCls}>Confirmar</button>
                    </form>
                  ) : (
                    <span className="text-xs text-gray-500">
                      aguardando Efí
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TeamInstallmentsPage(props: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { ok, error } = await props.searchParams;
  const { enabled } = getTeamInstallmentConfig();

  const overview = await getTeamInstallments().getInstallmentOverview();
  const months = overview.matrices[0]?.cells.map((c) => c.dueMonth) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Parcelas das equipes
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Conciliação dos Pix recebidos com as 9 parcelas mensais de cada
            equipe.
          </p>
        </div>
        <Link
          href="/admin/equipes/parcelas/export"
          prefetch={false}
          className={btnCls}
        >
          Exportar CSV
        </Link>
      </div>

      <details className="rounded-lg border bg-white p-4 text-sm text-gray-700">
        <summary className="cursor-pointer font-medium text-gray-900">
          Como usar esta tela
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>
            <b>Equipe × mês:</b> mostra cada parcela como PAGO, ABERTO (venceu e
            não foi paga), A VENCER ou PAGO NÃO CONFIRMADO (lançado à mão, ainda
            sem o Pix real na Efí).
          </li>
          <li>
            <b>Não atribuídos:</b> Pix de R$ 933,30 (ou múltiplos) que não
            conseguimos ligar a uma equipe. Escolha a equipe e clique em
            Atribuir; marque &quot;salvar nome como alias&quot; para os próximos
            Pix desse pagador já caírem na equipe certa.
          </li>
          <li>
            <b>Não confirmados:</b> quando o Pix real aparecer na Efí, cole o
            e2eId (começa com E) e clique em Confirmar. Nada é duplicado.
          </li>
          <li>
            <b>Lançamento manual:</b> use só quando o pagamento ainda não consta
            na Efí (ex.: comprovante). Fica auditado e marcado como não
            confirmado.
          </li>
          <li>
            Pagamentos chegam sozinhos pelo webhook e pela conciliação diária.
            Uma parcela paga por engano pode ser corrigida ajustando o
            lançamento, nunca editando a parcela.
          </li>
        </ul>
      </details>

      {!enabled && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          TEAM_INSTALLMENTS_ENABLED está desligado: webhook e job não estão
          alimentando o ledger. Lançamentos manuais continuam funcionando.
        </p>
      )}
      {ok && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          {ok}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Equipe × mês</h2>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-center text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="p-2 text-left">Equipe</th>
                {months.map((m) => (
                  <th key={m.toISOString()} className="p-2">
                    {dueLabel(m)}
                  </th>
                ))}
                <th className="p-2">Pago</th>
                <th className="p-2">Em aberto</th>
                <th className="p-2">A vencer</th>
              </tr>
            </thead>
            <tbody>
              {overview.matrices.map((m) => (
                <tr key={m.teamId} className="border-t">
                  <td className="p-2 text-left font-medium">{m.teamCode}</td>
                  {m.cells.map((c) => (
                    <td key={c.installmentId} className="p-1">
                      <span
                        className={`inline-block rounded px-1.5 py-1 font-medium ${CELL[c.state].className}`}
                      >
                        {CELL[c.state].label}
                      </span>
                    </td>
                  ))}
                  <td className="p-2 font-medium text-green-800">
                    {formatCents(m.totals.paidCents)}
                    {m.totals.unconfirmedCents > 0 && (
                      <div className="text-amber-800">
                        ({formatCents(m.totals.unconfirmedCents)} não confirm.)
                      </div>
                    )}
                  </td>
                  <td className="p-2 font-medium text-red-800">
                    {formatCents(m.totals.overdueCents)}
                  </td>
                  <td className="p-2 text-gray-600">
                    {formatCents(m.totals.upcomingCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Fila: não atribuídos</h2>
        <PaymentsTable
          rows={overview.unattributed}
          action="assign"
          empty="Nenhum Pix aguardando atribuição."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pagamentos não confirmados</h2>
        <PaymentsTable
          rows={overview.unconfirmed}
          action="promote"
          empty="Nenhum pagamento sem confirmação."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Lançamento manual</h2>
        <form
          action={createManualPaymentAction}
          className="grid max-w-2xl gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2"
        >
          <label className="text-sm">
            Data do pagamento
            <input
              type="date"
              name="paidAt"
              required
              className={`${inputCls} mt-1 w-full`}
            />
          </label>
          <label className="text-sm">
            Valor (R$)
            <input
              name="valor"
              required
              inputMode="decimal"
              placeholder="933,30"
              className={`${inputCls} mt-1 w-full`}
            />
          </label>
          <div className="text-sm">
            Equipe
            <div className="mt-1">
              <TeamSelect />
            </div>
          </div>
          <label className="text-sm">
            Pagador
            <input
              name="payerName"
              maxLength={120}
              className={`${inputCls} mt-1 w-full`}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            e2eId (opcional)
            <input
              name="endToEndId"
              maxLength={64}
              className={`${inputCls} mt-1 w-full`}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Observação
            <input
              name="note"
              maxLength={500}
              placeholder="ex.: comprovante enviado por WhatsApp"
              className={`${inputCls} mt-1 w-full`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="confirm" required />
            Conferi os dados; este lançamento ficará não confirmado e auditado.
          </label>
          <div className="sm:col-span-2">
            <button className={btnCls}>Registrar</button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ignorados e sobras</h2>
        <PaymentsTable
          rows={overview.outsideMatrix}
          empty="Nenhum registro fora da matriz."
        />
      </section>
    </div>
  );
}
