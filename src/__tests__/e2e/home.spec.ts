import { expect, test } from "@playwright/test";

test("landing page renders with enrollment call to action", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Acelere sua Equipe",
  );
  await expect(
    page.getByRole("link", { name: /Quero me Inscrever/ }),
  ).toHaveAttribute("href", "/enroll");
});
