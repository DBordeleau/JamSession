import { z } from "zod";

export const audioSourcesRequestSchema = z
  .object({
    assetIds: z
      .array(z.uuid())
      .min(1)
      .max(12)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate asset IDs"),
  })
  .strict();

export type SignedAudioSource = {
  assetId: string;
  signedUrl: string;
  expiresAt: string;
};
