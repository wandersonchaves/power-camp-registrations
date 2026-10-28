/** @jest-environment node */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildTeamInstallments } from "@/infra/team-installments/container";
import { makeImportTeamPayments } from "@/use-cases/team-installments/import-team-payments.use-case";
import { parsePaymentsCsv } from "@/use-cases/team-installments/parse-payments-csv";

const RUN = process.env.RUN_DB_TESTS === "1";
const UNIT = 93330;
const E2E = "E18236120202603201822s14e73cdb49";

// Segurança: jamais rodar contra banco que não seja local.
function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error("RUN_DB_TESTS exige DATABASE_URL apontando para localhost");
  }
}

(RUN ? describe : describe.skip)("recordTeamPayment (integração)", () => {
  let prisma: PrismaClient;
  let svc: ReturnType<typeof buildTeamInstallments>;
  let aguia: string;
  let leao: string;

  beforeAll(async () => {
    assertLocalDatabase();
    prisma = new PrismaClient();
    svc = buildTeamInstallments(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE "TeamPaymentAllocation","TeamPayment","TeamPayerAlias","TeamPaymentAuditLog","TeamInstallment","InitialPaymentAttempt","Enrollment","Participant","Event","User","Team" CASCADE`,
    );
    const mk = async (code: "AGUIA" | "LEAO") => {
      const team = await prisma.team.create({ data: { code, name: code } });
      await prisma.teamInstallment.createMany({
        data: Array.from({ length: 9 }, (_, i) => ({
          teamId: team.id,
          dueMonth: new Date(Date.UTC(2026, 3 + i, 10)),
          amountCents: UNIT,
        })),
      });
      return team.id;
    };
    aguia = await mk("AGUIA");
    leao = await mk("LEAO");
  });

  const base = (over = {}) => ({
    endToEndId: E2E,
    amountCents: UNIT,
    paidAt: new Date("2026-03-20T18:22:00Z"),
    source: "WEBHOOK" as const,
    teamId: aguia,
    ...over,
  });

  const linkTxidToTeam = async (txid: string, teamId: string) => {
    const user = await prisma.user.create({ data: {} });
    const event = await prisma.event.create({
      data: { name: "e", year: 2026 },
    });
    const participant = await prisma.participant.create({
      data: { eventId: event.id, userId: user.id, fullName: "x", cpf: "1" },
    });
    const enrollment = await prisma.enrollment.create({
      data: { eventId: event.id, participantId: participant.id, teamId },
    });
    await prisma.initialPaymentAttempt.create({
      data: {
        enrollmentId: enrollment.id,
        txid,
        status: "PAID",
        amount: "18.30",
        idempotencyKey: `k-${txid}`,
      },
    });
  };

  it("mesmo e2eId 20x em paralelo => 1 registro e 1 alocação", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => svc.recordTeamPayment(base())),
    );

    expect(results.filter((r) => r.outcome === "CREATED")).toHaveLength(1);
    expect(await prisma.teamPayment.count()).toBe(1);
    expect(await prisma.teamPaymentAllocation.count()).toBe(1);
    expect((await prisma.teamPayment.findFirstOrThrow()).status).toBe(
      "ALLOCATED",
    );
  });

  it("webhook + job + importação do mesmo Pix => 1 registro", async () => {
    await svc.recordTeamPayment(base({ source: "WEBHOOK" }));
    await svc.recordTeamPayment(base({ source: "RECONCILIATION" }));
    await svc.recordTeamPayment(base({ source: "IMPORT" }));

    expect(await prisma.teamPayment.count()).toBe(1);
    expect(await prisma.teamPaymentAllocation.count()).toBe(1);
  });

  it("txid de uma equipe e alias de outra => vence o txid", async () => {
    await linkTxidToTeam("txid-aguia", aguia);
    await prisma.teamPayerAlias.create({
      data: { teamId: leao, normalizedName: "codar pro ltda" },
    });

    await svc.recordTeamPayment(
      base({ teamId: null, txid: "txid-aguia", payerName: "CODAR.PRO LTDA" }),
    );

    const p = await prisma.teamPayment.findFirstOrThrow();
    expect(p.teamId).toBe(aguia);
    expect(p.attributionReason).toMatch(/txid/);
  });

  it("alias atribui quando não há txid; sem alias fica UNATTRIBUTED", async () => {
    await prisma.teamPayerAlias.create({
      data: { teamId: leao, normalizedName: "codar pro ltda" },
    });
    await svc.recordTeamPayment(
      base({ teamId: null, payerName: "Codar.Pro Ltda" }),
    );
    await svc.recordTeamPayment(
      base({ teamId: null, endToEndId: "E2", payerName: "Desconhecido" }),
    );

    const rows = await prisma.teamPayment.findMany({
      orderBy: { endToEndId: "asc" },
    });
    expect(rows.find((r) => r.endToEndId === E2E)?.teamId).toBe(leao);
    const orphan = rows.find((r) => r.endToEndId === "E2");
    expect(orphan).toMatchObject({ teamId: null, status: "UNATTRIBUTED" });
    expect(orphan?.attributionReason).toBeTruthy();
  });

  it("2x a parcela quita dois meses; Pix alheio automático é descartado", async () => {
    await svc.recordTeamPayment(base({ amountCents: UNIT * 2 }));
    const skipped = await svc.recordTeamPayment(
      base({ endToEndId: "E-noise", amountCents: 18300 }),
    );

    expect(skipped.outcome).toBe("SKIPPED");
    expect(await prisma.teamPayment.count()).toBe(1);
    expect(await prisma.teamPaymentAllocation.count()).toBe(2);
  });

  it("importação de valor não múltiplo fica IGNORED sem alocar", async () => {
    await svc.recordTeamPayment(
      base({ source: "IMPORT", amountCents: 18300, note: "aguarda decisão" }),
    );
    const p = await prisma.teamPayment.findFirstOrThrow();
    expect(p.status).toBe("IGNORED");
    expect(await prisma.teamPaymentAllocation.count()).toBe(0);
  });

  it("MANUAL sem e2eId ganha chave sintética e é auditado", async () => {
    await svc.recordTeamPayment({
      amountCents: UNIT,
      paidAt: new Date("2026-09-20T12:00:00Z"),
      source: "MANUAL",
      confirmation: "UNCONFIRMED",
      teamId: leao,
      userEmail: "admin@x.com",
    });
    const p = await prisma.teamPayment.findFirstOrThrow();
    expect(p.endToEndId).toMatch(/^MANUAL-/);
    expect(p.confirmation).toBe("UNCONFIRMED");
    expect(await prisma.teamPaymentAuditLog.count()).toBe(1);
  });

  describe("promoção MANUAL UNCONFIRMED -> CONFIRMED", () => {
    const manual = () =>
      svc.recordTeamPayment({
        amountCents: UNIT,
        paidAt: new Date("2026-09-20T12:00:00Z"),
        source: "MANUAL",
        confirmation: "UNCONFIRMED",
        teamId: leao,
      });

    it("e2eId real inédito: troca a chave, mantém 1 alocação", async () => {
      const m = await manual();
      if (m.outcome === "SKIPPED") throw new Error("unexpected");
      await svc.promotePayment({
        paymentId: m.paymentId,
        realEndToEndId: "EREAL",
      });

      const p = await prisma.teamPayment.findFirstOrThrow();
      expect(p).toMatchObject({
        endToEndId: "EREAL",
        confirmation: "CONFIRMED",
      });
      expect(await prisma.teamPayment.count()).toBe(1);
      expect(await prisma.teamPaymentAllocation.count()).toBe(1);
    });

    it("e2eId real já existente: funde sem duplicar alocação", async () => {
      const m = await manual();
      if (m.outcome === "SKIPPED") throw new Error("unexpected");
      // webhook chegou antes, sem equipe
      await svc.recordTeamPayment(
        base({ endToEndId: "EREAL", teamId: null, source: "WEBHOOK" }),
      );
      await svc.promotePayment({
        paymentId: m.paymentId,
        realEndToEndId: "EREAL",
      });

      const p = await prisma.teamPayment.findFirstOrThrow();
      expect(p).toMatchObject({
        endToEndId: "EREAL",
        teamId: leao,
        confirmation: "CONFIRMED",
        status: "ALLOCATED",
      });
      expect(await prisma.teamPayment.count()).toBe(1);
      expect(await prisma.teamPaymentAllocation.count()).toBe(1);
    });
  });
});

(RUN ? describe : describe.skip)("importação CSV (integração)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    assertLocalDatabase();
    prisma = new PrismaClient();
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("carga inicial: dry-run não grava; apply é idempotente e não duplica o MANUAL", async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE "TeamPaymentAllocation","TeamPayment","TeamPayerAlias","TeamPaymentAuditLog","TeamInstallment","Team" CASCADE`,
    );
    const ids: Record<"AGUIA" | "LEAO", string> = { AGUIA: "", LEAO: "" };
    for (const code of ["AGUIA", "LEAO"] as const) {
      const t = await prisma.team.create({ data: { code, name: code } });
      ids[code] = t.id;
      await prisma.teamInstallment.createMany({
        data: Array.from({ length: 9 }, (_, i) => ({
          teamId: t.id,
          dueMonth: new Date(Date.UTC(2026, 3 + i, 10)),
          amountCents: UNIT,
        })),
      });
    }
    const svc = buildTeamInstallments(prisma);
    const { rows } = parsePaymentsCsv(
      readFileSync(
        join(process.cwd(), "src/scripts/data/team-payments.initial.csv"),
        "utf8",
      ),
    );
    const run = makeImportTeamPayments({
      recordTeamPayment: svc.recordTeamPayment,
      paymentExists: async (endToEndId) =>
        (await prisma.teamPayment.count({ where: { endToEndId } })) > 0,
      teamIdByCode: ids,
      installmentAmountCents: UNIT,
    });

    const dry = await run({ rows, apply: false });
    expect(dry.every((r) => r.action === "CREATE")).toBe(true);
    expect(await prisma.teamPayment.count()).toBe(0);

    await run({ rows, apply: true });
    const second = await run({ rows, apply: true });
    expect(second.every((r) => r.action === "EXISTS")).toBe(true);

    expect(await prisma.teamPayment.count()).toBe(6);
    // LEAO: 2 confirmados + 1 manual; AGUIA: 3 => 3 parcelas cada
    expect(await prisma.teamPaymentAllocation.count()).toBe(6);
    expect(
      await prisma.teamPayment.count({
        where: { confirmation: "UNCONFIRMED" },
      }),
    ).toBe(1);
  });
});
