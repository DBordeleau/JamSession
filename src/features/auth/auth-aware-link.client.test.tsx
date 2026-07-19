import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthAwareLink } from "./auth-aware-link.client";

const getClaims = vi.fn();
const unsubscribe = vi.fn();
let authChange: (() => void) | undefined;

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getClaims,
      onAuthStateChange: (callback: () => void) => {
        authChange = callback;
        queueMicrotask(callback);
        return { data: { subscription: { unsubscribe } } };
      },
    },
  }),
}));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: unknown }) => (
    <a
      {...props}
      data-prefetch={prefetch === false ? "false" : "unspecified"}
    />
  ),
}));

const states = {
  signedOut: { href: "/sign-in", label: "Sign in" },
  signedIn: { href: "/settings/profile", label: "Account" },
};

describe("AuthAwareLink", () => {
  beforeEach(() => {
    getClaims.mockReset();
    unsubscribe.mockReset();
    authChange = undefined;
  });
  afterEach(cleanup);

  it("progressively replaces sign in with the authenticated destination", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "viewer-id" } },
      error: null,
    });
    render(<AuthAwareLink {...states} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
        "href",
        "/settings/profile",
      ),
    );
  });

  it("refreshes verified claims after an auth event", async () => {
    getClaims
      .mockResolvedValueOnce({ data: { claims: null }, error: null })
      .mockResolvedValueOnce({
        data: { claims: { sub: "viewer-id" } },
        error: null,
      });
    render(<AuthAwareLink {...states} />);
    await waitFor(() => expect(getClaims).toHaveBeenCalledOnce());

    authChange?.();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Account" })).toBeVisible(),
    );
  });

  it("forwards the footer no-prefetch policy across Auth states", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "viewer-id" } },
      error: null,
    });
    render(<AuthAwareLink {...states} prefetch={false} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
        "data-prefetch",
        "false",
      ),
    );
  });
});
