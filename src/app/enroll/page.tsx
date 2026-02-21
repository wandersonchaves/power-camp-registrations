import { startJourney3 } from "./actions";
import { TeamField } from "./TeamField.client";

export const runtime = "nodejs";

export default function EnrollPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="bg-card rounded-3xl border p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Inscrição — PowerCamp 2027</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Escolha o tipo e o número de parcelas. Os valores são calculados
            automaticamente.
          </p>

          <form action={startJourney3} className="mt-6 space-y-4">
            {/* ✅ Só esse pedaço vira Client Component */}
            <TeamField defaultTicketType="ANTECIPADA" defaultTeamCode="AGUIA" />

            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Nome completo
              </label>
              <input
                name="fullName"
                required
                className="bg-background focus:ring-ring mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
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
                className="bg-background focus:ring-ring mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
                placeholder="000.000.000-00"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  Email (opcional)
                </label>
                <input
                  name="email"
                  type="email"
                  className="bg-background focus:ring-ring mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  placeholder="voce@email.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="text-sm font-medium">
                  Telefone (opcional)
                </label>
                <input
                  name="phone"
                  className="bg-background focus:ring-ring mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  placeholder="(99) 99999-9999"
                />
              </div>
            </div>

            <div>
              <label htmlFor="parcelNumber" className="text-sm font-medium">
                Número de parcelas
              </label>
              <select
                name="installments"
                defaultValue="12"
                className="bg-background focus:ring-ring mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}x (todas iguais)
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground mt-1 text-xs">
                A 1ª parcela terá o mesmo valor das demais.
              </p>
            </div>

            <button
              type="submit"
              className="bg-primary text-primary-foreground w-full rounded-2xl px-4 py-3 text-sm font-medium hover:opacity-90"
            >
              Gerar Pix (1ª parcela)
            </button>

            <p className="text-muted-foreground text-xs">
              Após pagar a 1ª parcela, sua inscrição será confirmada
              automaticamente.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
