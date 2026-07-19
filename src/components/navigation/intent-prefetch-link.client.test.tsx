import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps, MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { IntentPrefetchLink } from "./intent-prefetch-link.client";

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

describe("IntentPrefetchLink", () => {
  it("starts without viewport prefetch and preserves ordinary link props", () => {
    const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
    render(
      <IntentPrefetchLink
        href="/studio"
        aria-current="page"
        className="nav-link"
        onClick={onClick}
      >
        Open Studio
      </IntentPrefetchLink>,
    );

    const link = screen.getByRole("link", { name: "Open Studio" });
    expect(link).toHaveAttribute("href", "/studio");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("nav-link");
    expect(link).toHaveAttribute("data-prefetch", "false");

    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("restores the Next.js default after mouse or pointer intent", () => {
    const onMouseEnter = vi.fn();
    const onPointerEnter = vi.fn();
    render(
      <IntentPrefetchLink
        href="/projects"
        onMouseEnter={onMouseEnter}
        onPointerEnter={onPointerEnter}
      >
        Projects
      </IntentPrefetchLink>,
    );

    const link = screen.getByRole("link", { name: "Projects" });
    fireEvent.mouseEnter(link);
    expect(onMouseEnter).toHaveBeenCalledOnce();
    expect(link).toHaveAttribute("data-prefetch", "default");

    fireEvent.pointerEnter(link);
    fireEvent.pointerLeave(link);
    expect(onPointerEnter).toHaveBeenCalledOnce();
    expect(link).toHaveAttribute("data-prefetch", "default");
  });

  it("restores the Next.js default after keyboard focus", () => {
    const onFocus = vi.fn();
    render(
      <IntentPrefetchLink href="/dashboard" onFocus={onFocus}>
        Dashboard
      </IntentPrefetchLink>,
    );

    const link = screen.getByRole("link", { name: "Dashboard" });
    fireEvent.focus(link);

    expect(onFocus).toHaveBeenCalledOnce();
    expect(link).toHaveAttribute("data-prefetch", "default");
  });
});
