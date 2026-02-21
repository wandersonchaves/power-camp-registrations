// src/app/page.tsx
import Link from "next/link";

const apiRoutes = [
  { label: "Criar Recorrência (Jornada 3) — POST", path: "/api/pix-auto/rec" },
  {
    label: "Criar Solicitação de Confirmação — POST",
    path: "/api/pix-auto/solicrec",
  },
  { label: "Criar Cobrança Recorrente — PUT/POST", path: "/api/pix-auto/cobr" },
];

const webhookRoutes = [
  { label: "Webhook Recorrência — POST", path: "/api/webhooks/efi/webhookrec" },
  {
    label: "Webhook Cobrança Recorrente — POST",
    path: "/api/webhooks/efi/webhookcobr",
  },
  {
    label: "Webhook Cobrança (fallback /cobr) — POST",
    path: "/api/webhooks/efi/webhookcobr/cobr",
  },
];

export default function HomePage() {
  const hasEventId = Boolean(process.env.POWERCAMP_EVENT_ID);

  // ✅ Ajuste aqui o destino "público" correto da inscrição:
  // - se você criou route group (public) com page em /enroll, mantenha "/enroll"
  // - se a inscrição agora está em outra rota pública (ex: /inscricao), troque aqui
  const enrollHref = "/enroll";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                PowerCamp Pix Automático
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Next.js + Prisma + TypeScript + Tailwind — Jornada 3 (Pix
                imediato + recorrência).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* ✅ CTA principal: inscrição/pagamento (público) */}
              <Link
                href={enrollHref}
                className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Fazer inscrição
              </Link>

              {/* ✅ Admin continua existindo, mas quem não for ADMIN será barrado pelo middleware */}
              <Link
                href="/admin/race"
                className="inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Abrir Admin
              </Link>

              <a
                href="/api/admin/efi/webhooks"
                className="inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Status Webhooks (API)
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <StatusCard
              title="Config do Evento"
              value={hasEventId ? "OK" : "Pendente"}
              description={
                hasEventId
                  ? "POWERCAMP_EVENT_ID definido no ambiente"
                  : "Defina POWERCAMP_EVENT_ID no ambiente para liberar o Admin"
              }
              tone={hasEventId ? "ok" : "warn"}
            />

            <StatusCard
              title="Webhooks"
              value="Prontos"
              description="Rotas preparadas para webhookrec e webhookcobr."
              tone="ok"
            />
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <RouteCard
            title="APIs Pix Automático"
            subtitle="Endpoints principais da Jornada 3."
            items={apiRoutes}
          />
          <RouteCard
            title="Webhooks Efí"
            subtitle="Recebimento de eventos (persistência + idempotência)."
            items={webhookRoutes}
          />
        </section>

        <footer className="mt-8 rounded-3xl border bg-white p-6 text-sm text-gray-600 shadow-sm">
          <div className="font-medium text-gray-900">Acesso</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              A página de <span className="font-medium">inscrição</span> é
              pública e fica em{" "}
              <Link className="font-mono underline" href={enrollHref}>
                {enrollHref}
              </Link>
              .
            </li>
            <li>
              As rotas <span className="font-mono">/admin/*</span> são restritas
              a usuários <span className="font-medium">ADMIN</span> (via
              middleware/NextAuth).
            </li>
          </ul>

          <div className="mt-5 font-medium text-gray-900">Notas rápidas</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Para webhookcobr, a Efí pode anexar{" "}
              <span className="font-mono">/cobr</span> ao final da URL — por
              isso existe a rota fallback.
            </li>
            <li>
              Em produção, recomendo usar um header{" "}
              <span className="font-mono">x-webhook-secret</span> e validar no
              handler.
            </li>
            <li>
              O Admin mostra corrida até 50 confirmados e o prêmio para o time
              vencedor.
            </li>
          </ul>
        </footer>
      </div>
    </main>
  );
}

function RouteCard(props: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; path: string }>;
}) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-sm font-semibold text-gray-900">{props.title}</div>
      <div className="mt-1 text-xs text-gray-600">{props.subtitle}</div>

      <div className="mt-4 space-y-2">
        {props.items.map((it) => (
          <div
            key={it.path}
            className="flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-900">
                {it.label}
              </div>
              <div className="truncate font-mono text-xs text-gray-600">
                {it.path}
              </div>
            </div>

            {/* mantém como <a> porque é endpoint (métodos variam / pode não ser página) */}
            <a
              href={it.path}
              className="shrink-0 rounded-xl border bg-white px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-50"
              rel="noreferrer"
            >
              Abrir
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusCard(props: {
  title: string;
  value: string;
  description: string;
  tone: "ok" | "warn";
}) {
  const badge =
    props.tone === "ok"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div className="rounded-2xl border bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-gray-600">{props.title}</div>
          <div className="mt-2 text-sm font-semibold text-gray-900">
            {props.value}
          </div>
          <div className="mt-1 text-xs text-gray-600">{props.description}</div>
        </div>
        <div className={`rounded-full border px-2 py-1 text-xs ${badge}`}>
          {props.tone === "ok" ? "OK" : "Atenção"}
        </div>
      </div>
    </div>
  );
}
