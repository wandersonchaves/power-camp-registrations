// src/app/enroll/TeamField.client.tsx
"use client";

import * as React from "react";

type Props = {
  defaultTicketType?: "ANTECIPADA" | "LOTE_ZERO";
  defaultTeamCode?: "AGUIA" | "LEAO";
};

export function TeamField({
  defaultTicketType = "ANTECIPADA",
  defaultTeamCode = "AGUIA",
}: Props) {
  const [ticketType, setTicketType] = React.useState<
    "ANTECIPADA" | "LOTE_ZERO"
  >(defaultTicketType);

  const isLoteZero = ticketType === "LOTE_ZERO";

  return (
    <>
      {/* Ticket Type (controlado aqui) */}
      <div>
        <label htmlFor="registrationType" className="text-sm font-medium">
          Tipo de inscrição
        </label>
        <select
          name="ticketType"
          value={ticketType}
          onChange={(e) =>
            setTicketType(e.target.value as "ANTECIPADA" | "LOTE_ZERO")
          }
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

      {/* Team Code */}
      <div>
        <label htmlFor="team" className="text-sm font-medium">
          Equipe (não disponível no Lote Zero)
        </label>

        {/* ✅ Quando for Lote Zero, NÃO envia teamCode (select disabled)
            e envia hidden vazio (garante payload consistente no server). */}
        <select
          name="teamCode"
          defaultValue={defaultTeamCode}
          disabled={isLoteZero}
          className={[
            "mt-1 w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900",
            isLoteZero ? "opacity-50" : "",
          ].join(" ")}
        >
          <option value="AGUIA">Equipe Águia</option>
          <option value="LEAO">Equipe Leão</option>
        </select>

        <input type="hidden" name="teamCode" value="" disabled={!isLoteZero} />

        <p className="mt-1 text-xs text-gray-600">
          No <strong>Lote Zero</strong>, a equipe não é escolhida aqui.
        </p>
      </div>
    </>
  );
}
