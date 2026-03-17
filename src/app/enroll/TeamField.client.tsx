// src/app/enroll/TeamField.client.tsx
"use client";

import * as React from "react";
import { User, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { TEAM_CONFIG, TeamCode } from "@/theme/team-config";
import { getTeamGradient } from "@/theme/team-styles";

type TicketType = "ANTECIPADA" | "LOTE_ZERO";
type PaymentMode = "INDIVIDUAL" | "COLLECTIVE";

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
  const [paymentMode, setPaymentMode] =
    React.useState<PaymentMode>("COLLECTIVE");

  const isLoteZero = ticketType === "LOTE_ZERO";
  const submittedTeamCode = isLoteZero ? "" : teamCode;

  const teams: TeamCode[] = ["AGUIA", "LEAO"];

  return (
    <div className="space-y-8">
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
      </div>

      {/* Team Selection */}
      <div
        className={cn(
          "space-y-3 transition-all duration-300",
          isLoteZero && "pointer-events-none opacity-40 grayscale",
        )}
      >
        <span className="text-muted-foreground text-sm font-bold uppercase tracking-wider">
          Escolha sua Equipe
        </span>
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

      {/* Payment Mode Selection */}
      <div
        className={cn(
          "space-y-3 transition-all duration-300",
          isLoteZero && "pointer-events-none opacity-40",
        )}
      >
        <span className="text-muted-foreground text-sm font-bold uppercase tracking-wider">
          Como deseja pagar as mensalidades?
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPaymentMode("COLLECTIVE")}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all",
              paymentMode === "COLLECTIVE"
                ? "border-primary bg-primary/5 shadow-md"
                : "border-muted bg-card opacity-70",
            )}
          >
            <div
              className={cn(
                "rounded-full p-2",
                paymentMode === "COLLECTIVE"
                  ? "bg-primary text-white"
                  : "bg-muted",
              )}
            >
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Plano de Equipe</p>
              <p className="text-muted-foreground text-[10px]">
                O líder da minha equipe paga por todos.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMode("INDIVIDUAL")}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all",
              paymentMode === "INDIVIDUAL"
                ? "border-primary bg-primary/5 shadow-md"
                : "border-muted bg-card opacity-70",
            )}
          >
            <div
              className={cn(
                "rounded-full p-2",
                paymentMode === "INDIVIDUAL"
                  ? "bg-primary text-white"
                  : "bg-muted",
              )}
            >
              <User className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">
                Plano Individual
              </p>
              <p className="text-muted-foreground text-[10px]">
                Eu mesmo pago minha mensalidade.
              </p>
            </div>
          </button>
        </div>
        <input type="hidden" name="paymentMode" value={paymentMode} />
        <p className="text-muted-foreground text-[11px] italic">
          * Independente do plano, a inscrição inicial deve ser paga
          individualmente.
        </p>
      </div>
    </div>
  );
}
