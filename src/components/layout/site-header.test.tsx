import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

const getClaims = vi.fn();

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: unknown }) => (
    <a
      {...props}
      data-prefetch={
        prefetch === false
          ? "false"
          : prefetch === null
            ? "default"
            : "unspecified"
      }
    />
  ),
}));
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getClaims,
      onAuthStateChange: (callback: () => void) => {
        queueMicrotask(callback);
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
        };
      },
    },
  }),
}));

describe("SiteHeader", () => {
  beforeEach(() => {
    getClaims.mockReset();
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });
  });
  afterEach(cleanup);

  it("shows the marketing shell with landing section links when signed out", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "OpenMIDI" })).toHaveAttribute(
      "href",
      "/",
    );

    const sections = screen.getByRole("navigation", { name: "Sections" });
    expect(
      within(sections).getByRole("link", { name: "The MIDI Library" }),
    ).toHaveAttribute("href", "/library");
    expect(
      within(sections).getByRole("link", { name: "Versioning" }),
    ).toHaveAttribute("href", "/#versioning");
    expect(
      within(sections).getByRole("link", { name: "Challenges" }),
    ).toHaveAttribute("href", "/challenges");

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(
      screen.queryByRole("link", { name: "Create something" }),
    ).not.toBeInTheDocument();

    expect(
      screen
        .getAllByRole("link")
        .every((link) => link.getAttribute("data-prefetch") === "false"),
    ).toBe(true);
  });

  it("keeps both signed-out and signed-in header links cold before intent", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "viewer-id" } },
      error: null,
    });
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );

    await waitFor(() =>
      expect(
        screen
          .getAllByRole("link", { name: "Account" })
          .every((link) => link.getAttribute("data-prefetch") === "false"),
      ).toBe(true),
    );
  });
});
