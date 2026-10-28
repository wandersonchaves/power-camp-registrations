import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import HomePage from "@/app/page";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("../../app/api/auth/[...nextauth]/auth-options", () => ({
  authOptions: {},
}));
jest.mock("../../lib/prisma", () => ({
  prisma: { event: { findFirst: jest.fn() } },
}));

describe("Homepage", () => {
  it("redirects admins to /admin/race", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { role: "ADMIN" },
    });

    await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/admin/race");
  });
});
