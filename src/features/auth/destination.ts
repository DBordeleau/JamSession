import type { ViewerProfile } from "@/features/profiles/types";

export type ViewerEntryPath =
  "/account-unavailable" | "/dashboard" | "/onboarding";

/**
 * One post-authentication routing rule for every entry surface. Account state
 * wins over onboarding state so suspended or deleted profiles never enter the
 * active application shell.
 */
export function getViewerEntryPath(
  profile: Pick<ViewerProfile, "profileCompletedAt" | "status">,
): ViewerEntryPath {
  if (profile.status !== "active") return "/account-unavailable";
  return profile.profileCompletedAt ? "/dashboard" : "/onboarding";
}
