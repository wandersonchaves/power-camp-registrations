import * as React from "react";

import { cn } from "@/lib/utils";
import { TEAM_CONFIG, TeamCode } from "@/theme/team-config";
import { getTeamGradient } from "@/theme/team-styles";

interface TeamScoreDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  team: TeamCode;
  score: number;
  label?: string;
}

export function TeamScoreDisplay({
  team,
  score,
  label = "Pontos",
  className,
  ...props
}: TeamScoreDisplayProps) {
  const config = TEAM_CONFIG[team];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border p-8 transition-all duration-300 hover:scale-105",
        team === "AGUIA"
          ? "border-blue-100 bg-blue-50/50 shadow-blue-50"
          : "border-red-100 bg-red-50/50 shadow-red-50",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "mb-1 text-5xl font-black tracking-tighter",
          team === "AGUIA" ? "text-blue-700" : "text-red-700",
        )}
      >
        {score.toLocaleString()}
      </span>
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest",
          getTeamGradient(team),
          "text-white shadow-md",
        )}
      >
        {config.icon} {label}
      </div>
    </div>
  );
}
