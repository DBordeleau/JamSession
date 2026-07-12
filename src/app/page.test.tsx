import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("./_components/bootstrap-reveal", () => ({
  BootstrapReveal: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Home", () => {
  it("describes the project foundation and collaboration model", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /make music like open source/i,
      }),
    ).toBeVisible();
    expect(screen.getByText(/project foundation initialized/i)).toBeVisible();
    expect(screen.getByText("Projects")).toBeVisible();
    expect(screen.getByText("Contributions")).toBeVisible();
    expect(screen.getByText("Forks")).toBeVisible();
  });
});
