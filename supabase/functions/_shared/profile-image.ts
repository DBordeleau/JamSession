export const PROFILE_IMAGE_VERSION = "profile-image-v1";
export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROFILE_IMAGE_PIXELS = 4096 * 4096;
export const MAX_PROFILE_AVATAR_BYTES = 512 * 1024;

export type ProfileImageMediaType = "image/jpeg" | "image/png" | "image/webp";

export class PermanentProfileImageError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PermanentProfileImageError";
  }
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function detectProfileImageSignature(
  bytes: Uint8Array,
): ProfileImageMediaType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8)
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  )
    return "image/webp";
  return null;
}

export function validateProfileImageMetadata(input: {
  signatureMediaType: ProfileImageMediaType | null;
  declaredMediaType: string;
  width: number;
  height: number;
  frameCount: number;
}) {
  if (
    input.signatureMediaType === null ||
    input.signatureMediaType !== input.declaredMediaType
  )
    throw new PermanentProfileImageError("unsupported_format");
  if (
    !Number.isInteger(input.width) ||
    !Number.isInteger(input.height) ||
    input.width < 128 ||
    input.height < 128 ||
    input.width > 4096 ||
    input.height > 4096 ||
    input.width * input.height > MAX_PROFILE_IMAGE_PIXELS
  )
    throw new PermanentProfileImageError("dimensions_invalid");
  if (input.frameCount !== 1)
    throw new PermanentProfileImageError("animated_image_unsupported");
  return { mediaType: input.signatureMediaType };
}

export async function profileImageSha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
