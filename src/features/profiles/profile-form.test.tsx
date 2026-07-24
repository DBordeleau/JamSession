import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveProfileAction } from "./actions";
import { ProfileForm } from "./profile-form";

vi.mock("./actions", () => ({
  saveProfileAction: vi.fn(),
}));

const completedProfile = {
  username: "nightkeys",
  displayName: "Night Keys",
  creditName: "Night Keys",
  bio: "Warm loops after midnight.",
};

afterEach(cleanup);

describe("ProfileForm", () => {
  it("presents a saved username as locked information in settings", () => {
    render(<ProfileForm profile={completedProfile} variant="settings" />);

    expect(
      screen.queryByRole("textbox", { name: /Username/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("@nightkeys")).toBeVisible();
    expect(screen.getByText("Permanent")).toBeVisible();
    expect(screen.getByLabelText("Display name")).toHaveClass("settings-field");
  });

  it("keeps onboarding editable and free of the settings-only surface", () => {
    render(
      <ProfileForm
        profile={{
          username: null,
          displayName: null,
          creditName: null,
          bio: null,
        }}
        returnTo="/dashboard"
      />,
    );

    const username = screen.getByRole("textbox", {
      name: /Username/,
    });
    expect(username).not.toHaveClass("settings-field");
    expect(username).not.toHaveAttribute("readonly");
    expect(
      screen.getByRole("button", { name: "Complete profile" }),
    ).toBeEnabled();
    expect(document.querySelector('input[name="returnTo"]')).toHaveAttribute(
      "value",
      "/dashboard",
    );
  });

  it("shows field validation and pending feedback accessibly", async () => {
    vi.mocked(saveProfileAction).mockResolvedValue({
      message: "Check the highlighted fields.",
      fields: {
        displayName: ["Enter a display name."],
        creditName: ["Enter a credit name."],
      },
    });
    render(<ProfileForm profile={completedProfile} variant="settings" />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Credit name"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(screen.getByText("Check the highlighted fields.")).toHaveAttribute(
        "role",
        "alert",
      ),
    );
    expect(screen.getByText("Enter a display name.")).toBeVisible();
    expect(screen.getByLabelText("Display name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
