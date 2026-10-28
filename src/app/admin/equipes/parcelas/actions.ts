"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseReaisToCents } from "@/domain/team-installments/money";
import { getTeamInstallments } from "@/infra/team-installments/container";
import { requireAdmin } from "@/lib/auth/guards";

const PAGE = "/admin/equipes/parcelas";
const TEAM = z.enum(["AGUIA", "LEAO"]);

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const manualSchema = z.object({
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida"),
  valor: z
    .string()
    .refine((v) => parseReaisToCents(v) !== null, "valor inválido"),
  team: TEAM,
  payerName: optional(120),
  endToEndId: optional(64),
  note: optional(500),
  confirm: z.literal("on", {
    errorMap: () => ({ message: "confirme os dados" }),
  }),
});

function done(kind: "ok" | "error", message: string): never {
  revalidatePath(PAGE);
  redirect(`${PAGE}?${kind}=${encodeURIComponent(message)}`);
}

const field = (fd: FormData, key: string) =>
  fd.get(key)?.toString() ?? undefined;

export async function createManualPaymentAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = manualSchema.safeParse({
    paidAt: field(formData, "paidAt"),
    valor: field(formData, "valor"),
    team: field(formData, "team"),
    payerName: field(formData, "payerName"),
    endToEndId: field(formData, "endToEndId"),
    note: field(formData, "note"),
    confirm: field(formData, "confirm"),
  });
  if (!parsed.success) {
    done("error", parsed.error.issues.map((i) => i.message).join("; "));
  }
  const input = parsed.data;

  let message: string;
  try {
    const svc = getTeamInstallments();
    const teamId = await svc.readModel.findTeamIdByCode(input.team);
    if (!teamId) throw new Error("equipe não encontrada");

    const result = await svc.recordTeamPayment({
      endToEndId: input.endToEndId,
      amountCents: parseReaisToCents(input.valor) as number,
      paidAt: new Date(`${input.paidAt}T12:00:00.000Z`),
      payerName: input.payerName,
      source: "MANUAL",
      confirmation: "UNCONFIRMED",
      teamId,
      attributionReason: "lançamento manual por admin",
      note: input.note,
      createdByUserId: session.user?.id ?? null,
      userEmail: session.user?.email ?? null,
    });
    message =
      result.outcome === "EXISTING"
        ? "Esse Pix já estava registrado; nada duplicado."
        : "Lançamento registrado (não confirmado até chegar o e2eId real).";
  } catch (err) {
    done("error", err instanceof Error ? err.message : "falha ao registrar");
  }
  done("ok", message);
}

export async function assignPaymentAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = z
    .object({
      paymentId: z.string().min(1),
      team: TEAM,
      saveAlias: z.string().optional(),
    })
    .safeParse({
      paymentId: field(formData, "paymentId"),
      team: field(formData, "team"),
      saveAlias: field(formData, "saveAlias"),
    });
  if (!parsed.success) done("error", "dados inválidos");
  const { paymentId, team, saveAlias } = parsed.data;

  let message: string;
  try {
    const svc = getTeamInstallments();
    const teamId = await svc.readModel.findTeamIdByCode(team);
    if (!teamId) throw new Error("equipe não encontrada");

    const { aliasSaved } = await svc.assignPaymentToTeam({
      paymentId,
      teamId,
      saveAlias: saveAlias === "on",
      userEmail: session.user?.email ?? null,
    });
    message = aliasSaved
      ? "Pagamento atribuído e alias do pagador salvo."
      : "Pagamento atribuído.";
  } catch (err) {
    done("error", err instanceof Error ? err.message : "falha ao atribuir");
  }
  done("ok", message);
}

export async function promotePaymentAction(formData: FormData) {
  const session = await requireAdmin();

  const parsed = z
    .object({
      paymentId: z.string().min(1),
      realEndToEndId: z.string().trim().min(10).max(64),
    })
    .safeParse({
      paymentId: field(formData, "paymentId"),
      realEndToEndId: field(formData, "realEndToEndId"),
    });
  if (!parsed.success) done("error", "e2eId inválido");

  try {
    await getTeamInstallments().promotePayment({
      ...parsed.data,
      userEmail: session.user?.email ?? null,
    });
  } catch (err) {
    done("error", err instanceof Error ? err.message : "falha ao confirmar");
  }
  done("ok", "Pagamento confirmado.");
}
