const encoder = new TextEncoder();

export async function challengeRotationKey(input: {
  challengeId: string;
  challengeVersionId: string;
  entryId: string;
  rotationBucket: string;
}) {
  const bucket = new Date(input.rotationBucket);
  if (
    !Number.isFinite(bucket.getTime()) ||
    bucket.getUTCMinutes() !== 0 ||
    bucket.getUTCSeconds() !== 0 ||
    bucket.getUTCMilliseconds() !== 0
  )
    throw new Error("challenge_rotation_bucket_invalid");
  const payload = `${input.challengeId}:${input.challengeVersionId}:${bucket.toISOString()}:${input.entryId}`;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
