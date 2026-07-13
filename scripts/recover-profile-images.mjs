import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secret = process.env.PROFILE_IMAGE_RECOVERY_SECRET;
if (!url || !key || !secret)
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PROFILE_IMAGE_RECOVERY_SECRET are required.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let claimed = 0;
for (let index = 0; index < 10; index += 1) {
  const { data, error } = await db.functions.invoke("process-profile-image", {
    body: { mode: "recover" },
    headers: { "x-profile-image-recovery-secret": secret },
  });
  if (error) throw error;
  if (!data?.claimed) break;
  claimed += 1;
}
console.log(`Accepted ${claimed} due profile image job(s).`);
