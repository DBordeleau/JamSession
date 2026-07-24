import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContributionList } from "./contribution-list";
import type { ContributionListItem, ContributionStatus } from "./types";

vi.mock("@/components/ui/reveal.client", () => ({
  Reveal: ({
    as: As = "div",
    children,
    ...props
  }: {
    as?: "div" | "section" | "li";
    children: React.ReactNode;
  }) => <As {...props}>{children}</As>,
}));

const statuses: ContributionStatus[] = [
  "draft",
  "submitted",
  "changes_requested",
  "accepted",
  "rejected",
  "withdrawn",
];

afterEach(cleanup);

function contribution(
  status: ContributionStatus,
  index: number,
): ContributionListItem {
  return {
    id: `10000000-0000-4000-8000-00000000000${index}`,
    projectId: `20000000-0000-4000-8000-00000000000${index}`,
    projectTitle: `Project ${index}`,
    title: `${status} proposal`,
    status,
    baseRevisionId: `30000000-0000-4000-8000-00000000000${index}`,
    currentVersionNumber: status === "draft" ? null : index,
    trackCount: 3,
    durationMs: 12_400,
    baseRevisionNumber: 2,
    currentRevisionNumber: status === "changes_requested" ? 3 : 2,
    isStale: status === "changes_requested",
    updatedAt: "2026-07-23T18:30:00.000Z",
  };
}

describe("ContributionList", () => {
  it("distinguishes every lifecycle state with readable labels and icons", () => {
    render(
      <ContributionList
        contributions={statuses.map((status, index) =>
          contribution(status, index + 1),
        )}
      />,
    );

    for (const label of [
      "Draft",
      "Submitted",
      "Changes requested",
      "Accepted",
      "Rejected",
      "Withdrawn",
    ])
      expect(screen.getByText(label)).toBeVisible();
    for (const label of [
      "Draft",
      "Submitted",
      "Changes requested",
      "Accepted",
      "Rejected",
      "Withdrawn",
    ])
      expect(screen.getByText(label).querySelector("svg")).toBeInTheDocument();
  });

  it("keeps exact destinations and makes base freshness explicit", () => {
    render(
      <ContributionList
        contributions={[
          contribution("submitted", 1),
          contribution("changes_requested", 2),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "submitted proposal" }),
    ).toHaveAttribute(
      "href",
      "/projects/20000000-0000-4000-8000-000000000001/contributions/10000000-0000-4000-8000-000000000001",
    );
    expect(screen.getByText("Base is current")).toBeVisible();
    expect(screen.getByText("Base is behind")).toBeVisible();
    expect(screen.getAllByText(/3 tracks/)).toHaveLength(2);
    expect(screen.getAllByText(/12.4 sec/)).toHaveLength(2);
  });

  it("gives an empty filter a strong next action", () => {
    render(<ContributionList contributions={[]} filter="history" />);

    expect(
      screen.getByRole("heading", {
        name: "Your finished proposals will collect here.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Explore open projects" }),
    ).toHaveAttribute("href", "/explore");
  });
});
