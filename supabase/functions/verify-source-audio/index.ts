import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import { parseBlob } from "npm:music-metadata@11.13.0";

import {
  detectSourceAudioSignature,
  MAX_SOURCE_AUDIO_BYTES,
  PermanentVerificationError,
  sha256Hex,
  SOURCE_AUDIO_VERIFICATION_VERSION,
  validateSourceAudioMetadata,
} from "../_shared/source-verification.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

type Claim = {
  asset_id: string;
  owner_id: string;
  bucket: string;
  object_path: string;
  original_filename: string;
  reserved_byte_size: number;
  lease_token: string;
  attempt_count: number;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

function event(
  name: string,
  claim?: Pick<Claim, "asset_id" | "attempt_count">,
) {
  console.log(
    JSON.stringify({
      event: name,
      assetId: claim?.asset_id,
      attempt: claim?.attempt_count,
    }),
  );
}

async function retryClaim(
  serviceClient: ReturnType<typeof createClient>,
  claim: Claim,
  code: string,
) {
  const { data, error } = await serviceClient.rpc(
    "operator_retry_source_verification",
    {
      p_asset_id: claim.asset_id,
      p_lease_token: claim.lease_token,
      p_error_code: code,
    },
  );
  if (error) {
    event("asset_verification_terminal_command_failed", claim);
    return;
  }
  event(
    data === "dead"
      ? "asset_verification_dead"
      : "asset_verification_retry_scheduled",
    claim,
  );
}

async function processClaim(
  serviceClient: ReturnType<typeof createClient>,
  claim: Claim,
) {
  event("asset_verification_claimed", claim);
  try {
    const { data: blob, error: downloadError } = await serviceClient.storage
      .from(claim.bucket)
      .download(claim.object_path);
    if (downloadError || !blob) {
      await retryClaim(serviceClient, claim, "download_failed");
      return;
    }
    if (
      blob.size > MAX_SOURCE_AUDIO_BYTES ||
      blob.size !== Number(claim.reserved_byte_size)
    ) {
      throw new PermanentVerificationError("size_mismatch");
    }

    const signature = detectSourceAudioSignature(
      new Uint8Array(await blob.slice(0, 12).arrayBuffer()),
    );
    let metadata;
    try {
      metadata = await parseBlob(blob, { duration: true, skipCovers: true });
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
    const bytes = await blob.arrayBuffer();
    const hash = await sha256Hex(bytes);

    const { error } = await serviceClient.rpc(
      "operator_complete_source_verification",
      {
        p_asset_id: claim.asset_id,
        p_lease_token: claim.lease_token,
        p_media_type: trusted.mediaType,
        p_byte_size: blob.size,
        p_sha256: hash,
        p_duration_ms: trusted.durationMs,
        p_sample_rate_hz: trusted.sampleRateHz,
        p_channels: trusted.channels,
        p_verification_version: SOURCE_AUDIO_VERIFICATION_VERSION,
      },
    );
    if (error) {
      event("asset_verification_terminal_command_failed", claim);
      return;
    }
    event("asset_verification_succeeded", claim);
  } catch (error) {
    if (error instanceof PermanentVerificationError) {
      const { error: failError } = await serviceClient.rpc(
        "operator_fail_source_verification",
        {
          p_asset_id: claim.asset_id,
          p_lease_token: claim.lease_token,
          p_failure_code: error.code,
        },
      );
      event(
        failError
          ? "asset_verification_terminal_command_failed"
          : "asset_verification_permanent_failed",
        claim,
      );
      return;
    }
    await retryClaim(serviceClient, claim, "worker_error");
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const recoverySecret = Deno.env.get("ASSET_VERIFICATION_RECOVERY_SECRET");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !recoverySecret) {
    return json({ error: "worker_not_configured" }, 503);
  }

  const token = bearerToken(request);
  if (!token) return json({ error: "unauthorized" }, 401);

  let body: { assetId?: unknown; mode?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const isRecovery =
    body.mode === "recover" &&
    request.headers.get("x-verification-recovery-secret") === recoverySecret;
  let ownerId: string | null = null;
  let assetId: string | null = null;
  if (!isRecovery) {
    if (typeof body.assetId !== "string" || !uuidPattern.test(body.assetId)) {
      return json({ error: "invalid_asset" }, 400);
    }
    assetId = body.assetId;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data.user) return json({ error: "unauthorized" }, 401);
    ownerId = data.user.id;
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await serviceClient.rpc(
    "operator_claim_source_verification",
    { p_asset_id: assetId, p_owner_id: ownerId },
  );
  if (error) return json({ error: "claim_failed" }, 503);
  const claim = (data?.[0] ?? null) as Claim | null;
  if (!claim) return json({ accepted: true, claimed: false }, 202);

  event(
    isRecovery ? "asset_verification_recovered" : "asset_verification_accepted",
    claim,
  );
  EdgeRuntime.waitUntil(processClaim(serviceClient, claim));
  return json({ accepted: true, claimed: true }, 202);
});
