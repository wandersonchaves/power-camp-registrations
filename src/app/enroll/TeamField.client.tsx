// src/app/enroll/TeamField.client.tsx
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { TEAM_CONFIG, TeamCode } from "@/theme/team-config";
import { getTeamGradient } from "@/theme/team-styles";

type TicketType = "ANTECIPADA" | "LOTE_ZERO";

type Props = {
  defaultTicketType?: TicketType;
  defaultTeamCode?: TeamCode;
};

export function TeamField({
  defaultTicketType = "ANTECIPADA",
  defaultTeamCode = "AGUIA",
}: Props) {
  const [ticketType, setTicketType] =
    React.useState<TicketType>(defaultTicketType);

  const [teamCode, setTeamCode] = React.useState<TeamCode>(defaultTeamCode);

  const isLoteZero = ticketType === "LOTE_ZERO";
  const submittedTeamCode = isLoteZero ? "" : teamCode;

  const teams: TeamCode[] = ["AGUIA", "LEAO"];

  return (
    <div className="space-y-6">
      {/* Ticket Type */}
      <div className="space-y-2">
        <label
          htmlFor="ticketType"
          className="text-muted-foreground text-sm font-bold uppercase tracking-wider"
        >
          Tipo de inscrição
        </label>

        <select
          id="ticketType"
          name="ticketType"
          value={ticketType}
          onChange={(e) => setTicketType(e.target.value as TicketType)}
          className="border-muted bg-background focus:border-primary focus:ring-primary/10 w-full rounded-2xl border-2 px-4 py-3 text-sm font-medium outline-none transition-all focus:ring-4"
        >
          <option value="ANTECIPADA">
            Inscrição Antecipada (Escolha sua equipe)
          </option>
          <option value="LOTE_ZERO">Lote Zero (Sorteio presencial)</option>
        </select>

        <p className="text-muted-foreground text-xs italic">
          {isLoteZero
            ? "⚠️ No Lote Zero, sua equipe será definida por sorteio na data do evento."
            : "✅ Escolha a equipe que você deseja representar."}
        </p>
      </div>

      {/* Team Selection (Visual) */}
      <div
        className={cn(
          "space-y-3 transition-opacity duration-300",
          isLoteZero && "pointer-events-none opacity-40",
        )}
      >
        <label
          htmlFor="team"
          className="text-muted-foreground text-sm font-bold uppercase tracking-wider"
        >
          Escolha sua Equipe
        </label>

        <div className="grid grid-cols-2 gap-4">
          {teams.map((t) => {
            const isSelected = teamCode === t && !isLoteZero;
            const config = TEAM_CONFIG[t];

            return (
              <button
                key={t}
                type="button"
                onClick={() => setTeamCode(t)}
                className={cn(
                  "relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border-2 p-6 transition-all duration-300",
                  isSelected
                    ? cn(
                        "scale-105 border-transparent shadow-xl",
                        t === "AGUIA" ? "shadow-blue-200" : "shadow-red-200",
                      )
                    : "border-muted bg-card opacity-70 grayscale-[0.5] hover:border-gray-300",
                )}
              >
                {/* Background Gradient when selected */}
                {isSelected && (
                  <div
                    className={cn(
                      "absolute inset-0 opacity-10",
                      getTeamGradient(t),
                    )}
                  />
                )}

                <span className="mb-2 text-4xl">{config.icon}</span>
                <span
                  className={cn(
                    "font-black tracking-tight",
                    isSelected
                      ? t === "AGUIA"
                        ? "text-blue-700"
                        : "text-red-700"
                      : "text-muted-foreground",
                  )}
                >
                  {config.name}
                </span>

                {isSelected && (
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-1.5",
                      getTeamGradient(t),
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <input type="hidden" name="teamCode" value={submittedTeamCode} />
      </div>
    </div>
  );
}
