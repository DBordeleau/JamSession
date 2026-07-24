import { cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Template from "./template";

const routeState = vi.hoisted(() => ({
  reducedMotion: false,
}));

vi.mock("motion/react", async () => {
  const React = await import("react");
  type MotionDivProps = ComponentProps<"div"> & {
    animate?: unknown;
    initial?: unknown;
    transition?: unknown;
  };

  return {
    motion: {
      div: ({ animate, initial, transition, ...props }: MotionDivProps) => {
        void animate;
        return (
          <div
            {...props}
            data-motion-initial={JSON.stringify(initial)}
            data-motion-transition={JSON.stringify(transition)}
          />
        );
      },
    },
    useReducedMotion: () => routeState.reducedMotion,
  };
});

describe("route template", () => {
  afterEach(() => {
    cleanup();
    routeState.reducedMotion = false;
  });

  it("marks and fades the route wrapper for structural overlay overrides", () => {
    const { container } = render(
      <Template>
        <p>Explore</p>
      </Template>,
    );
    const wrapper = container.firstElementChild;

    expect(wrapper).toHaveAttribute("data-route-template");
    expect(wrapper).toHaveAttribute(
      "data-motion-initial",
      JSON.stringify({ opacity: 0 }),
    );
    expect(wrapper).toHaveAttribute(
      "data-motion-transition",
      JSON.stringify({
        duration: 0.35,
        ease: [0.2, 0.8, 0.2, 1],
      }),
    );
  });

  it("keeps reduced-motion route entry instant", () => {
    routeState.reducedMotion = true;
    const { container } = render(
      <Template>
        <p>Explore</p>
      </Template>,
    );

    expect(container.firstElementChild).toHaveAttribute(
      "data-motion-initial",
      "false",
    );
  });
});
