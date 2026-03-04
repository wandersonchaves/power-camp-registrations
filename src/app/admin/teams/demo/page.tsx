import { TeamBadge } from "@/components/teams/team-badge";
import { TeamCard } from "@/components/teams/team-card";
import { TeamScoreDisplay } from "@/components/teams/team-score-display";
import { getTeamGradient } from "@/theme/team-styles";

export default function TeamsBrandingDemo() {
  return (
    <div className="mx-auto max-w-6xl space-y-12 p-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Personalização de Equipes
        </h1>
        <p className="text-muted-foreground">
          Componentes visuais adaptativos por equipe.
        </p>
      </section>

      {/* Grid de Placar */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <TeamScoreDisplay team="AGUIA" score={12500} label="Pontuação Geral" />
        <TeamScoreDisplay team="LEAO" score={11850} label="Pontuação Geral" />
      </div>

      {/* Grid de Cards e Badges */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <TeamCard
          team="AGUIA"
          title="Status da Equipe"
          subtitle="Equipe Águia está na liderança aérea."
          gradient
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TeamBadge team="AGUIA" />
              <TeamBadge team="AGUIA" showIcon={false} />
            </div>
            <p className="text-sm">
              Inscritos Pagos:{" "}
              <span className="font-bold text-blue-600">85</span>
            </p>
          </div>
        </TeamCard>

        <TeamCard
          team="LEAO"
          title="Status da Equipe"
          subtitle="Equipe Leão demonstra força total."
          gradient
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TeamBadge team="LEAO" />
              <TeamBadge team="LEAO" showIcon={false} />
            </div>
            <p className="text-sm">
              Inscritos Pagos:{" "}
              <span className="font-bold text-red-600">79</span>
            </p>
          </div>
        </TeamCard>
      </div>

      {/* Exemplo de Botões e Gradientes Diretos */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Helpers Visuais (Tailwind)</h2>
        <div className="flex flex-wrap gap-4">
          <button
            className={`rounded-full px-6 py-2 font-bold text-white transition-all hover:scale-105 ${getTeamGradient("AGUIA")}`}
          >
            Ação Águia
          </button>
          <button
            className={`rounded-full px-6 py-2 font-bold text-white transition-all hover:scale-105 ${getTeamGradient("LEAO")}`}
          >
            Ação Leão
          </button>
        </div>
      </div>
    </div>
  );
}
