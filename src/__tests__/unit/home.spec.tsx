import { render, screen } from "@testing-library/react";

import Home from "@/app/page";

describe("Homepage", () => {
  it("renders the Components", () => {
    render(<Home />);

    const heading = screen.getByText("Next.js power template", {
      selector: "h1",
    });

    expect(heading).toBeInTheDocument();
  });
});
