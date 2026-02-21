"use server";

import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createEnrollmentAndStartJourney3UseCase } from "@/use-cases/enrollment/create-enrollment-and-start-journey3.use-case";

const schema = z.object({
  ticketType: z.enum(["ANTECIPADA", "LOTE_ZERO"]),
  fullName: z.string().min(3).max(120),
  cpf: z.string().min(11).max(14),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  installments: z.coerce.number().int().min(1).max(12),
});

type PlanPayload = {
  ticketTotalTarget: string;
  ticketTotalEffective: string;
  installments: number;
  installmentAmount: string;
  firstPaymentAmount: string;
  recurringAmount: string;
  recurringCount: number;
  isSinglePayment: boolean;
  roundingDifference: string;
};

type AttemptPayload = {
  ticketType?: "ANTECIPADA" | "LOTE_ZERO";
  teamCode?: "AGUIA" | "LEAO" | null;
  plan?: PlanPayload;
};

function assertEnv(name: string): string {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} não definido.`);
  return v;
}

function cleanCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

function normalizeMoney(value: string): string {
  const raw = String(value).trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Valor inválido.");
  return n.toFixed(2);
}

function moneyToCents(v: string): number {
  const raw = normalizeMoney(v);
  const [i, d = "00"] = raw.split(".");
  return Number(i) * 100 + Number(String(d).padEnd(2, "0").slice(0, 2));
}

function centsToMoney(cents: number): string {
  const abs = Math.abs(cents);
  const i = Math.floor(abs / 100);
  const d = String(abs % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}${i}.${d}`;
}

function computeEqualInstallmentsPlan(params: {
  total: string;
  installments: number;
}): PlanPayload {
  const totalC = moneyToCents(params.total);
  const n = params.installments;

  const installmentC = Math.floor(totalC / n);
  const effectiveTotalC = installmentC * n;

  return {
    ticketTotalTarget: normalizeMoney(params.total),
    ticketTotalEffective: centsToMoney(effectiveTotalC),
    installments: n,
    installmentAmount: centsToMoney(installmentC),
    firstPaymentAmount: centsToMoney(installmentC),
    recurringAmount: centsToMoney(installmentC),
    recurringCount: Math.max(0, n - 1),
    isSinglePayment: n === 1,
    roundingDifference: centsToMoney(effectiveTotalC - totalC),
  };
}

function toYYYYMMDDUTC(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMonthsUTC(base: Date, months: number) {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function jsonObject(
  v: Prisma.JsonValue | null | undefined,
): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export async function startJourney3(formData: FormData) {
  const input = schema.parse({
    ticketType: String(formData.get("ticketType") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    cpf: String(formData.get("cpf") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    installments: formData.get("installments"),
  });

  const eventId = assertEnv("POWERCAMP_EVENT_ID");
  const ownerUserId = assertEnv("POWERCAMP_OWNER_USER_ID");

  const antecipadaTeamCode = (process.env.POWERCAMP_ANTECIPADA_TEAM_CODE ??
    "AGUIA") as "AGUIA" | "LEAO";

  const antecipadaTotal = process.env.POWERCAMP_ANTECIPADA_TOTAL ?? "250.00";
  const loteZeroTotal = process.env.POWERCAMP_LOTE_ZERO_TOTAL ?? "0.00";

  const ticketTotal =
    input.ticketType === "ANTECIPADA" ? antecipadaTotal : loteZeroTotal;

  const cpf = cleanCpf(input.cpf);
  if (cpf.length !== 11) {
    throw new Error("CPF inválido. Informe um CPF com 11 dígitos.");
  }

  const plan = computeEqualInstallmentsPlan({
    total: ticketTotal,
    installments: input.installments,
  });

  // Participant idempotente por (eventId, cpf)
  const participant = await prisma.participant.upsert({
    where: { eventId_cpf: { eventId, cpf } },
    update: {
      fullName: input.fullName,
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
    },
    create: {
      eventId,
      userId: ownerUserId,
      fullName: input.fullName,
      cpf,
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
    },
    select: { id: true },
  });

  // janela da recorrência (n-1 cobranças a partir do próximo mês)
  const firstRecDate = addMonthsUTC(new Date(), 1);
  const dataInicial = toYYYYMMDDUTC(firstRecDate);
  const remaining = plan.recurringCount;

  const dataFinal =
    remaining > 1
      ? toYYYYMMDDUTC(addMonthsUTC(firstRecDate, remaining - 1))
      : undefined;

  const out = await createEnrollmentAndStartJourney3UseCase({
    eventId,
    participantId: participant.id,
    teamCode: input.ticketType === "ANTECIPADA" ? antecipadaTeamCode : null,

    immediateAmount: plan.firstPaymentAmount,
    recurringAmount: plan.isSinglePayment
      ? plan.firstPaymentAmount
      : plan.recurringAmount,

    contrato: `ENROLLMENT:${eventId}:${participant.id}`,
    objeto:
      input.ticketType === "ANTECIPADA"
        ? "PowerCamp 2027 - Antecipada"
        : "PowerCamp 2027 - Lote Zero",
    periodicidade: "MENSAL",
    dataInicial,
    dataFinal,

    solicitacaoPagador:
      input.ticketType === "ANTECIPADA"
        ? `PowerCamp 2027 - Antecipada (${plan.installments}x)`
        : `PowerCamp 2027 - Lote Zero (${plan.installments}x)`,
  });

  // Enriquecer attempt.payload com dados do plano/ticket (mantendo o que já existe)
  const attempt = await prisma.initialPaymentAttempt.findFirst({
    where: { enrollmentId: out.enrollmentId },
    select: { id: true, payload: true },
    orderBy: { createdAt: "desc" },
  });

  if (attempt) {
    const prev = jsonObject(attempt.payload) as AttemptPayload;

    await prisma.initialPaymentAttempt.update({
      where: { id: attempt.id },
      data: {
        payload: {
          ...prev,
          ticketType: input.ticketType,
          teamCode:
            input.ticketType === "ANTECIPADA" ? antecipadaTeamCode : null,
          plan,
        } satisfies AttemptPayload,
      },
    });
  }

  redirect(
    `/enroll/success?enrollmentId=${encodeURIComponent(out.enrollmentId)}`,
  );
}
