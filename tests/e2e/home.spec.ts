import { expect, test } from "@playwright/test";

test("loads the Jam Session foundation page without browser errors", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/");

  await expect(page).toHaveTitle("Jam Session");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make music like open source.",
  );
  expect(pageErrors).toEqual([]);
});
