import { startJourney3 } from "./actions";

export const runtime = "nodejs";

export default function EnrollPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Inscrição — PowerCamp 2027</h1>
          <p className="mt-1 text-sm text-gray-600">
            Jornada 3: Pix imediato (1ª parcela) + criação da recorrência
            mensal.
          </p>

          <form action={startJourney3} className="mt-6 space-y-4">
            <div>
              <label htmlFor="team" className="text-sm font-medium">
                Equipe
              </label>
              <select
                name="teamCode"
                className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                defaultValue="AGUIA"
              >
                <option value="AGUIA">Equipe Águia</option>
                <option value="LEAO">Equipe Leão</option>
              </select>
            </div>

            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Nome completo
              </label>
              <input
                name="fullName"
                required
                className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="Ex: Wanderson Chaves"
              />
            </div>

            <div>
              <label htmlFor="cpf" className="text-sm font-medium">
                CPF
              </label>
              <input
                name="cpf"
                required
                className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="000.000.000-00"
              />
              <p className="mt-1 text-xs text-gray-600">
                Pode digitar com pontos e traço — eu limpo antes de enviar.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Email (opcional)
                </label>
                <input
                  name="email"
                  type="email"
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="voce@email.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="text-sm font-medium">
                  Telefone (opcional)
                </label>
                <input
                  name="phone"
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="(99) 99999-9999"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="initialPayment" className="text-sm font-medium">
                  Pagamento inicial
                </label>
                <input
                  name="firstPaymentAmount"
                  required
                  defaultValue="10.00"
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="10.00"
                />
                <p className="mt-1 text-xs text-gray-600">Formato: 0.00</p>
              </div>

              <div>
                <label htmlFor="monthlyFee" className="text-sm font-medium">
                  Mensalidade
                </label>
                <input
                  name="monthlyAmount"
                  required
                  defaultValue="35.00"
                  className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="35.00"
                />
                <p className="mt-1 text-xs text-gray-600">Formato: 0.00</p>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              Gerar Pix (imediato + recorrência)
            </button>

            <p className="text-xs text-gray-600">
              Após pagar o Pix imediato, o webhook confirma e sua inscrição
              entra no placar.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
