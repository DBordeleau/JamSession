import { createClient } from "@supabase/supabase-js";

const execute = process.argv.includes("--execute");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: due, error: countError } = await db.rpc(
  "operator_count_due_profile_avatar_cleanup",
);
if (countError) throw countError;
console.log(
  `${execute ? "Cleaning" : "Would clean"} ${due} due avatar version(s).`,
);
if (!execute) process.exit(0);
for (let index = 0; index < Math.min(Number(due), 100); index += 1) {
  const { data, error } = await db.rpc("operator_claim_profile_avatar_cleanup");
  const claim = data?.[0];
  if (error) throw error;
  if (!claim) break;
  const [publicResult, privateResult] = await Promise.all([
    db.storage.from("public-avatars").remove([claim.public_object_path]),
    db.storage.from("profile-images").remove([claim.private_object_path]),
  ]);
  if (publicResult.error || privateResult.error) {
    await db.rpc("operator_retry_profile_avatar_cleanup", {
      p_avatar_version_id: claim.avatar_version_id,
      p_lease_token: claim.lease_token,
      p_error_code: "storage_delete_failed",
    });
    continue;
  }
  const { error: completeError } = await db.rpc(
    "operator_complete_profile_avatar_cleanup",
    {
      p_avatar_version_id: claim.avatar_version_id,
      p_lease_token: claim.lease_token,
    },
  );
  if (completeError) throw completeError;
}
