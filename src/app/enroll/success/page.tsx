import Link from "next/link";
import { redirect } from "next/navigation";

import { pixAutoClient } from "@/infra/efi/pix-auto.client";
import { prisma } from "@/lib/prisma";

type SearchParams = Record<string, string | string[] | undefined>;
function pickString(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function safeCobPix(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const cob = p["cob"];
  if (!cob || typeof cob !== "object") return null;
  const c = cob as Record<string, unknown>;
  const v = c["pixCopiaECola"];
  return typeof v === "string" && v.trim() ? v : null;
}

function safeRecPix(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const recGet = p["recGet"];
  if (!recGet || typeof recGet !== "object") return null;
  const rg = recGet as Record<string, unknown>;
  const dadosQR = rg["dadosQR"];
  if (!dadosQR || typeof dadosQR !== "object") return null;
  const dq = dadosQR as Record<string, unknown>;
  const v = dq["pixCopiaECola"];
  return typeof v === "string" && v.trim() ? v : null;
}

export const runtime = "nodejs";

async function refreshRecQrAction(formData: FormData) {
  "use server";

  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) return;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, eventId: true, participantId: true },
  });
  if (!enrollment) return;

  const attempt = await prisma.initialPaymentAttempt.findUnique({
    where: { enrollmentId },
    select: { txid: true, payload: true },
  });

  const rec = await prisma.pixAutoRecurrence.findFirst({
    where: {
      eventId: enrollment.eventId,
      participantId: enrollment.participantId,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, idRec: true, status: true },
  });

  if (!rec?.idRec) {
    redirect(`/enroll/success?enrollmentId=${enrollmentId}`);
  }

  const txid = attempt?.txid ?? undefined;

  // Reconsulta a Rec (como você validou no Postman: /v2/rec/:idRec?txid=...)
  const recGet = await pixAutoClient.rec.get(
    rec.idRec,
    txid ? { txid } : undefined,
  );

  const pixCopiaECola = recGet.dadosQR?.pixCopiaECola ?? null;
  const jornada = recGet.dadosQR?.jornada ?? null;

  await prisma.pixAutoRecurrence.update({
    where: { id: rec.id },
    data: {
      status: recGet.status ?? rec.status,
      pixCopiaECola,
      jornada,
    },
  });

  // opcional: também atualizar payload do attempt pra debug/visibilidade
  if (pixCopiaECola || jornada) {
    const base = asObject(attempt?.payload);

    await prisma.initialPaymentAttempt.update({
      where: { enrollmentId },
      data: {
        payload: {
          ...base,
          recGet,
        },
      },
    });
  }

  redirect(`/enroll/success?enrollmentId=${enrollmentId}`);
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export default async function EnrollSuccessPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const enrollmentId = pickString(searchParams.enrollmentId) ?? "";

  if (!enrollmentId) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          EnrollmentId ausente.
        </div>
      </div>
    );
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      status: true,
      reservedAt: true,
      confirmedAt: true,
      team: { select: { name: true } },
      participantId: true,
      eventId: true,
      participant: {
        select: {
          fullName: true,
          cpf: true,
          email: true,
          phone: true,
        },
      },
      initialPayment: {
        select: {
          txid: true,
          status: true,
          amount: true,
          paidAt: true,
          payload: true,
        },
      },
    },
  });

  if (!enrollment) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6">
          Inscrição não encontrada.
        </div>
      </div>
    );
  }

  const recurrence = await prisma.pixAutoRecurrence.findFirst({
    where: {
      participantId: enrollment.participantId,
      eventId: enrollment.eventId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      idRec: true,
      status: true,
      pixCopiaECola: true,
      jornada: true,
      valorRec: true,
      periodicidade: true,
    },
  });

  const payload = enrollment.initialPayment?.payload as unknown;
  const cobPix = safeCobPix(payload); // ✅ Pix do pagamento inicial
  const recPixFromPayload = safeRecPix(payload);
  const recPix = recurrence?.pixCopiaECola ?? recPixFromPayload ?? null;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-xl space-y-4 px-4 py-10">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Pix gerado ✅</h1>
          <p className="mt-1 text-sm text-gray-600">
            Para confirmar sua inscrição, pague o <b>Pix imediato</b> abaixo.
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div>
              <span className="font-medium">Participante:</span>{" "}
              {enrollment.participant.fullName}
            </div>
            <div>
              <span className="font-medium">Equipe:</span>{" "}
              {enrollment.team.name}
            </div>
            <div>
              <span className="font-medium">Status:</span> {enrollment.status}
            </div>

            <div className="mt-2 rounded-2xl border bg-gray-50 p-3">
              <div className="text-xs font-semibold">
                Pagamento inicial (COB)
              </div>
              <div className="mt-1 font-mono text-xs">
                TXID: {enrollment.initialPayment?.txid ?? "-"}
              </div>
              <div className="mt-1 text-xs">
                Status: {enrollment.initialPayment?.status ?? "-"}
              </div>
              <div className="mt-1 text-xs">
                Valor: {enrollment.initialPayment?.amount ?? "-"}
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold">
                  Pix Copia e Cola (COB)
                </div>
                <textarea
                  readOnly
                  className="mt-2 h-28 w-full rounded-2xl border bg-white p-3 font-mono text-xs outline-none"
                  value={cobPix ?? "Ainda não disponível. Recarregue a página."}
                />
                <p className="mt-2 text-xs text-gray-600">
                  Esse é o Pix do pagamento inicial. Ao pagar, seu webhook deve
                  marcar a inscrição como CONFIRMED.
                </p>
              </div>
            </div>

            <div className="mt-2 rounded-2xl border bg-gray-50 p-3">
              <div className="text-xs font-semibold">Recorrência (REC)</div>
              <div className="mt-1 text-xs">
                Status: {recurrence?.status ?? "-"}
              </div>
              <div className="mt-1 text-xs">
                Periodicidade: {recurrence?.periodicidade ?? "-"}
              </div>
              <div className="mt-1 text-xs">
                Valor: {recurrence?.valorRec ?? "-"}
              </div>
              <div className="mt-1 text-xs">
                Jornada: {recurrence?.jornada ?? "-"}
              </div>

              <div className="mt-3">
                <div className="text-xs font-semibold">
                  Pix Copia e Cola (REC) — pode demorar para aparecer
                </div>
                <textarea
                  readOnly
                  className="mt-2 h-28 w-full rounded-2xl border bg-white p-3 font-mono text-xs outline-none"
                  value={recPix ?? "Ainda não disponível."}
                />
                <p className="mt-2 text-xs text-gray-600">
                  Se ainda estiver vazio, clique em <b>Atualizar recorrência</b>
                  .
                </p>

                <form action={refreshRecQrAction} className="mt-3">
                  <input
                    type="hidden"
                    name="enrollmentId"
                    value={enrollment.id}
                  />
                  <button
                    type="submit"
                    className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-medium hover:bg-gray-50"
                  >
                    Atualizar recorrência / QR
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              href="/admin/race"
              className="flex-1 rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-gray-800"
            >
              Ver placar
            </Link>
            <Link
              href="/enroll"
              className="flex-1 rounded-2xl border bg-white px-4 py-3 text-center text-sm font-medium hover:bg-gray-50"
            >
              Nova inscrição
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
