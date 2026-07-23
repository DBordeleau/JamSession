import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const publicProfileId = "f0000000-0000-4000-8000-000000000001";
const hiddenProfileId = "f0000000-0000-4000-8000-000000000002";

function seedPublicProfileFixture() {
  const sql = `
    begin;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values
        ('00000000-0000-0000-0000-000000000000','${publicProfileId}','authenticated','authenticated','profile-canvas@example.test','','{}','{}',now(),now()),
        ('00000000-0000-0000-0000-000000000000','${hiddenProfileId}','authenticated','authenticated','profile-hidden@example.test','','{}','{}',now(),now())
      on conflict (id) do nothing;
    update public.profiles
      set username='ProfileCanvas',
          username_normalized='profilecanvas',
          display_name='Profile Canvas',
          credit_name='Canvas Credits',
          bio=null,
          profile_completed_at=now(),
          status='active',
          moderation_state='visible',
          purged_at=null,
          avatar_config=null
      where id='${publicProfileId}';
    update public.profiles
      set username='HiddenCanvas',
          username_normalized='hiddencanvas',
          display_name='Hidden Canvas',
          credit_name='Hidden Credits',
          profile_completed_at=now(),
          status='active',
          moderation_state='hidden',
          purged_at=null
      where id='${hiddenProfileId}';
    commit;
  `;
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_openmidi",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
}

test.describe("public profile presentation", () => {
  test.skip(
    process.env.ENABLE_PUBLIC_PROFILE_E2E !== "true",
    "requires the deterministic local profile fixture",
  );

  test("keeps sparse identity useful, private states hidden, and mobile layout bounded", async ({
    page,
  }) => {
    seedPublicProfileFixture();
    const avatarEgress: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (
        /dicebear/i.test(url) ||
        url.includes("/storage/v1/") ||
        url.includes("/functions/v1/")
      )
        avatarEgress.push(url);
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/@ProfileCanvas");
    await expect(
      page.getByRole("heading", { level: 1, name: "Profile Canvas" }),
    ).toBeVisible();
    await expect(
      page.getByText("@ProfileCanvas", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Canvas Credits")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "The set list is still open." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No accepted contributions yet." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No challenge awards yet." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report this profile" }),
    ).toHaveAttribute(
      "href",
      `/reports/new?kind=profile&id=${publicProfileId}&label=%40ProfileCanvas`,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(avatarEgress).toEqual([]);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Report this profile" }),
    ).toBeFocused();
    expect(
      await page
        .getByRole("link", { name: "Report this profile" })
        .evaluate((element) => getComputedStyle(element).outlineStyle),
    ).not.toBe("none");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);

    await page.goto("/@HiddenCanvas");
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
});
