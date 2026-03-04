import { TEAM_CONFIG, TeamCode } from "./team-config";

/**
 * Retorna as classes de base (background e texto) conforme a equipe.
 */
export const getTeamBaseStyles = (team: TeamCode) => {
  return team === "AGUIA"
    ? "bg-blue-600 text-white hover:bg-blue-700"
    : "bg-red-600 text-white hover:bg-red-700";
};

/**
 * Retorna classes de gradiente.
 * Águia: Ar (leve/claro) | Leão: Fogo (intenso/escuro)
 */
export const getTeamGradient = (team: TeamCode, direction = "to-r") => {
  const config = TEAM_CONFIG[team].colors;
  return `bg-gradient-${direction} ${config.gradient}`;
};

/**
 * Estilo de Borda / Accent.
 */
export const getTeamAccentBorder = (team: TeamCode) => {
  return team === "AGUIA" ? "border-blue-400" : "border-red-500";
};

/**
 * Estilo do Badge.
 */
export const getTeamBadgeClasses = (team: TeamCode) => {
  return team === "AGUIA"
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-red-100 text-red-700 border-red-200";
};

/**
 * Helper para obter o nome formatado (ex: 🦁 Leão)
 */
export const getTeamDisplayName = (team: TeamCode) => {
  const config = TEAM_CONFIG[team];
  return `${config.icon} ${config.name}`;
};
