import { z } from "zod";

import { getSourceVerificationStatus } from "@/server/repositories/assets";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await context.params;
  if (!z.uuid().safeParse(assetId).success) {
    return Response.json(
      { error: "invalid_asset" },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  try {
    const status = await getSourceVerificationStatus(assetId);
    return Response.json(status, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "verification_status_unavailable" },
      { status: 404, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
