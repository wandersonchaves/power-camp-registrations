import { Progress50 } from "../_components/Progress50";
import { StatCard } from "../_components/StatCard";
import { getRaceScoreboard } from "../_data/admin.queries";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function RacePage() {
  // MVP: usar env do evento atual
  const eventId = process.env.POWERCAMP_EVENT_ID ?? "";
  if (!eventId) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="text-sm font-semibold">Falta configurar</div>
        <div className="mt-2 text-sm text-gray-700">
          Defina <span className="font-mono text-xs">POWERCAMP_EVENT_ID</span>{" "}
          no .env
        </div>
      </div>
    );
  }

  const data = await getRaceScoreboard({ eventId });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Placar</h1>
        <p className="mt-1 text-sm text-gray-600">
          Regra: vence quem atingir primeiro{" "}
          <span className="font-semibold">50 inscrições confirmadas</span>{" "}
          (pagamento inicial liquidado).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.teams.map((t) => (
          <StatCard
            key={t.teamCode}
            title={t.teamName}
            value={`${t.confirmed} confirmados`}
            subtitle={`${t.pending} pendentes`}
            right={<Progress50 confirmed={t.confirmed} />}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">Marco dos 50</div>
          <div className="mt-3 space-y-3 text-sm">
            {data.teams.map((t) => (
              <div
                key={t.teamCode}
                className="flex items-start justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0"
              >
                <div>
                  <div className="font-medium">{t.teamName}</div>
                  {t.milestone50 ? (
                    <div className="mt-1 text-xs text-gray-600">
                      Atingiu em{" "}
                      <span className="font-medium">
                        {fmtDate(t.milestone50.achievedAt)}
                      </span>{" "}
                      — txid{" "}
                      <span className="font-mono">{t.milestone50.txid}</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-600">
                      Ainda não atingiu 50 confirmados.
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-600">{t.confirmed}/50</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">Prêmio</div>
          {data.award ? (
            <div className="mt-3 space-y-2 text-sm">
              <div>
                Vencedor:{" "}
                <span className="font-semibold">
                  {data.award.winnerTeamName}
                </span>
              </div>
              <div>
                Pontos:{" "}
                <span className="font-semibold">
                  {data.award.pointsGranted}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                Decidido em {fmtDate(data.award.decidedAt)}
              </div>
              <div className="text-xs text-gray-600">
                {data.award.decidedByRule}
              </div>
              {data.award.tieBreakNote ? (
                <div className="text-xs text-gray-600">
                  {data.award.tieBreakNote}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-700">
              Ainda não definido. O prêmio é criado automaticamente quando{" "}
              <span className="font-semibold">os dois times</span> registrarem o
              marco 50.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
