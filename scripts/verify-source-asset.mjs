import { createClient } from "@supabase/supabase-js";
import { parseBlob } from "music-metadata";
import {
  detectSourceAudioSignature,
  MAX_SOURCE_AUDIO_BYTES,
  PermanentVerificationError,
  sha256Hex,
  SOURCE_AUDIO_VERIFICATION_VERSION,
  validateSourceAudioMetadata,
} from "../supabase/functions/_shared/source-verification.ts";

const id = process.argv[2];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!id || !url || !key)
  throw new Error(
    "Usage: npm run assets:verify -- <asset-uuid>; NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: claims, error: claimError } = await db.rpc(
  "operator_claim_source_verification",
  { p_asset_id: id, p_owner_id: null },
);
const claim = claims?.[0];
if (claimError || !claim)
  throw new Error("Asset is unavailable, delayed, or already being verified.");
try {
  const { data, error: downloadError } = await db.storage
    .from(claim.bucket)
    .download(claim.object_path);
  if (downloadError) throw downloadError;
  if (
    data.size > MAX_SOURCE_AUDIO_BYTES ||
    data.size !== Number(claim.reserved_byte_size)
  )
    throw new PermanentVerificationError("size_mismatch");
  const signature = detectSourceAudioSignature(
    new Uint8Array(await data.slice(0, 12).arrayBuffer()),
  );
  let metadata;
  try {
    metadata = await parseBlob(data, { duration: true, skipCovers: true });
  } catch {
    throw new PermanentVerificationError("unreadable_audio");
  }
  const trusted = validateSourceAudioMetadata({
    signatureMediaType: signature,
    container: metadata.format.container,
    durationSeconds: metadata.format.duration,
    sampleRateHz: metadata.format.sampleRate,
    channels: metadata.format.numberOfChannels,
  });
  const bytes = await data.arrayBuffer();
  const { error: promoteError } = await db.rpc(
    "operator_complete_source_verification",
    {
      p_asset_id: id,
      p_lease_token: claim.lease_token,
      p_media_type: trusted.mediaType,
      p_byte_size: bytes.byteLength,
      p_sha256: await sha256Hex(bytes),
      p_duration_ms: trusted.durationMs,
      p_sample_rate_hz: trusted.sampleRateHz,
      p_channels: trusted.channels,
      p_verification_version: SOURCE_AUDIO_VERIFICATION_VERSION,
    },
  );
  if (promoteError) throw promoteError;
  console.log(
    `Verified ${id} as ${trusted.mediaType} (${bytes.byteLength} bytes).`,
  );
} catch (error) {
  const permanent = error instanceof PermanentVerificationError;
  const code = permanent ? error.code : "operator_error";
  await db.rpc(
    permanent
      ? "operator_fail_source_verification"
      : "operator_retry_source_verification",
    permanent
      ? {
          p_asset_id: id,
          p_lease_token: claim.lease_token,
          p_failure_code: code,
        }
      : {
          p_asset_id: id,
          p_lease_token: claim.lease_token,
          p_error_code: code,
        },
  );
  throw new Error(`Verification failed: ${code}`);
}
