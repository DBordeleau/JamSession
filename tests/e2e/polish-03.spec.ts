import { expect, test } from "@playwright/test";

async function signInCompletedActor(page: import("@playwright/test").Page) {
  await page.goto("/test-auth");
  await page.getByRole("button", { name: "Sign in test actor" }).click();
  await page
    .getByRole("heading", {
      name: /Create your public profile|Start something/,
    })
    .waitFor();
  if (
    await page
      .getByRole("heading", { name: "Create your public profile" })
      .isVisible()
  ) {
    await page.getByLabel(/Username/).fill("Polish03E2E");
    await page.getByLabel("Display name").fill("POLISH 03 Artist");
    await page.getByLabel(/Credit name/).fill("POLISH 03 Artist");
    await page.getByRole("button", { name: "Complete profile" }).click();
    await page.waitForURL(/\/dashboard$/);
  }
}

async function expectMobileQuality(
  page: import("@playwright/test").Page,
  width: 320 | 390,
) {
  await page.setViewportSize({ width, height: 844 });
  const quality = await page.locator("main").evaluate((main) => {
    const visibleInteractive = Array.from(
      main.querySelectorAll<HTMLElement>(
        'a, button, input:not([type="hidden"]), textarea',
      ),
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      tooShort: visibleInteractive
        .filter((element) => element.getBoundingClientRect().height < 44)
        .map((element) => ({
          label:
            element.getAttribute("aria-label") ??
            element.textContent?.trim() ??
            element.tagName,
          height: element.getBoundingClientRect().height,
        })),
    };
  });
  expect(
    quality.scrollWidth,
    JSON.stringify(quality, null, 2),
  ).toBeLessThanOrEqual(quality.viewportWidth);
  expect(quality.tooShort, JSON.stringify(quality, null, 2)).toEqual([]);
}

test.describe("POLISH-03 authenticated surfaces", () => {
  test.skip(
    process.env.ENABLE_TEST_AUTH !== "true",
    "requires the local gated Auth actor",
  );

  test.beforeEach(async ({ page }) => {
    await signInCompletedActor(page);
  });

  test("keeps the dashboard contribution action independent and motion-aware", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/dashboard");
    const explore = page.getByRole("link", {
      name: "Explore open projects",
    });
    await expect(explore).toBeVisible();
    const label = explore.locator("span");
    const arrow = explore.locator("svg");
    await expect(label).toHaveCount(1);
    await expect(arrow).toHaveCount(1);

    const initial = await explore.evaluate((link) => ({
      labelColor: getComputedStyle(link.querySelector("span")!).color,
      labelTranslate: getComputedStyle(link.querySelector("span")!).translate,
      arrowTranslate: getComputedStyle(link.querySelector("svg")!).translate,
    }));
    await explore.hover();
    await expect
      .poll(async () =>
        arrow.evaluate((icon) => getComputedStyle(icon).translate),
      )
      .not.toBe(initial.arrowTranslate);
    const hovered = await explore.evaluate((link) => ({
      labelColor: getComputedStyle(link.querySelector("span")!).color,
      labelTranslate: getComputedStyle(link.querySelector("span")!).translate,
    }));
    expect(hovered.labelColor).not.toBe(initial.labelColor);
    expect(hovered.labelTranslate).toBe(initial.labelTranslate);

    await page.mouse.move(0, 0);
    await explore.focus();
    await expect
      .poll(async () =>
        arrow.evaluate((icon) => getComputedStyle(icon).translate),
      )
      .not.toBe(initial.arrowTranslate);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.mouse.move(0, 0);
    await explore.hover();
    await expect
      .poll(async () =>
        arrow.evaluate((icon) => getComputedStyle(icon).translate),
      )
      .toBe(initial.arrowTranslate);
  });

  test("preserves contribution filters, empty actions, and mobile quality", async ({
    page,
  }) => {
    await page.goto("/contributions");
    const filters = page.getByRole("navigation", {
      name: "Contribution filters",
    });
    await expect(filters.getByRole("link", { name: "Active" })).toHaveAttribute(
      "href",
      "/contributions?status=active",
    );
    await expect(
      filters.getByRole("link", { name: "Submitted" }),
    ).toHaveAttribute("href", "/contributions?status=submitted");
    await expect(
      filters.getByRole("link", { name: "History" }),
    ).toHaveAttribute("href", "/contributions?status=history");
    await expect(
      page.getByRole("link", { name: "Explore open projects" }),
    ).toHaveAttribute("href", "/explore");

    await filters.getByRole("link", { name: "Submitted" }).click();
    await expect(page).toHaveURL(/\/contributions\?status=submitted$/);
    await expect(
      page.getByRole("link", { name: "Browse open projects" }),
    ).toHaveAttribute("href", "/explore");

    for (const width of [320, 390] as const)
      await expectMobileQuality(page, width);
  });

  test("treats profile identity and editable settings distinctly", async ({
    page,
  }) => {
    await page.goto("/settings/profile");
    const displayName = page.getByRole("textbox", { name: "Display name" });
    const creditName = page.getByRole("textbox", { name: "Credit name" });
    const bio = page.getByRole("textbox", { name: "Bio" });
    await expect(displayName).toHaveClass(/settings-field/);
    await expect(creditName).toHaveClass(/settings-field/);
    await expect(bio).toHaveClass(/settings-field/);
    await expect(page.getByText("Permanent", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Username/ })).toHaveCount(
      0,
    );

    const beforeFocus = await displayName.evaluate(
      (field) => getComputedStyle(field).boxShadow,
    );
    await displayName.focus();
    await expect
      .poll(() =>
        displayName.evaluate((field) => getComputedStyle(field).boxShadow),
      )
      .not.toBe(beforeFocus);

    await displayName.fill("");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(displayName).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Enter a display name.")).toBeVisible();

    for (const width of [320, 390] as const)
      await expectMobileQuality(page, width);
  });
});
