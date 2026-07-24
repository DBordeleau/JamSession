import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

describe("auth server actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns signed-out users to the landing page", async () => {
    const signOutFromSupabase = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signOut: signOutFromSupabase },
    } as never);

    await signOut();

    expect(signOutFromSupabase).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
