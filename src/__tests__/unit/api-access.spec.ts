/**
 * @jest-environment node
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { apiAccessFor } from "@/lib/auth/api-access";

describe("apiAccessFor", () => {
  it.each([
    "/api/auth/signin",
    "/api/auth/callback/credentials",
    "/api/webhooks/efi/pix",
    "/api/webhooks/efi/webhookrec/rec",
    "/api/cron/team-payments-reconcile",
    "/api/enrollments/cm1abc/status",
  ])("%s is public", (p) => {
    expect(apiAccessFor(p)).toBe("public");
  });

  it.each([
    "/api/admin/team/participants",
    "/api/admin/efi/webhooks",
    "/api/admin/reconcile",
    "/api/admin/migration/sync",
    "/api/pix-auto/rec",
    "/api/pix-auto/cobr",
    "/api/pix-auto/retry",
    "/api/enrollments/journey3",
    "/api/enrollments/cm1abc/other",
    "/api/anything-new",
    "/api/authx/foo",
    "/api/cronjob",
  ])("%s requires an admin", (p) => {
    expect(apiAccessFor(p)).toBe("admin");
  });

  it("only the expected route files are public", () => {
    const root = join(process.cwd(), "src/app/api");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name === "route.ts") files.push(full);
      }
    };
    walk(root);
    const publicRoutes = files
      .map(
        (f) =>
          "/api/" +
          relative(root, f)
            .replace(/\/?route\.ts$/, "")
            .split(sep)
            .join("/")
            .replace(/\[\.\.\.[^\]]+\]/g, "x")
            .replace(/\[[^\]]+\]/g, "id"),
      )
      .map((p) => p.replace(/\/$/, ""))
      .filter((p) => apiAccessFor(p) === "public")
      .filter(
        (p) =>
          !p.startsWith("/api/webhooks/efi") &&
          !p.startsWith("/api/cron") &&
          !p.startsWith("/api/auth"),
      );
    expect(publicRoutes).toEqual(["/api/enrollments/id/status"]);
  });
});
