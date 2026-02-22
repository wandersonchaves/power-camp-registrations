// src/app/enroll/TeamField.client.tsx
"use client";

import * as React from "react";

type TicketType = "ANTECIPADA" | "LOTE_ZERO";
type TeamCode = "AGUIA" | "LEAO";

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

  // ✅ Se virar Lote Zero, “limpa” teamCode enviado
  // (mantemos o state do select para quando voltar a ANTECIPADA)
  const submittedTeamCode = isLoteZero ? "" : teamCode;

  return (
    <>
      {/* Ticket Type */}
      <div>
        <label htmlFor="ticketType" className="text-sm font-medium">
          Tipo de inscrição
        </label>

        <select
          id="ticketType"
          name="ticketType"
          value={ticketType}
          onChange={(e) => setTicketType(e.target.value as TicketType)}
          className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="ANTECIPADA">
            Inscrição antecipada (escolha de equipes)
          </option>
          <option value="LOTE_ZERO">Lote Zero (sorteio na bolinha)</option>
        </select>

        <p className="mt-1 text-xs text-gray-600">
          Se selecionar <strong>Lote Zero</strong>, a equipe será definida
          depois.
        </p>
      </div>

      {/* Team Code (UI) */}
      <div>
        <label htmlFor="teamCodeSelect" className="text-sm font-medium">
          Equipe (não disponível no Lote Zero)
        </label>

        {/* ✅ Select sem "name" (apenas UI). O que vale é o hidden abaixo. */}
        <select
          id="teamCodeSelect"
          value={teamCode}
          onChange={(e) => setTeamCode(e.target.value as TeamCode)}
          disabled={isLoteZero}
          className={[
            "mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900",
            isLoteZero ? "opacity-50" : "",
          ].join(" ")}
        >
          <option value="AGUIA">Equipe Águia</option>
          <option value="LEAO">Equipe Leão</option>
        </select>

        {/* ✅ Um ÚNICO campo enviado para o server */}
        <input type="hidden" name="teamCode" value={submittedTeamCode} />

        <p className="mt-1 text-xs text-gray-600">
          No <strong>Lote Zero</strong>, a equipe não é escolhida aqui.
        </p>
      </div>
    </>
  );
}
