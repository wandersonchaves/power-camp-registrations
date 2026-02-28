import { redirect } from "next/navigation";

import HomePage from "@/app/page";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("Homepage", () => {
  it("redirects to /enroll", () => {
    HomePage();
    expect(redirect).toHaveBeenCalledWith("/enroll");
  });
});
