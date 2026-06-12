import { apiError, handleApiError } from "@/lib/http";
import { authenticateDevice, buildManifest } from "@/lib/player";

export async function GET(
  request: Request,
  context: { params: Promise<{ screenCode: string }> },
) {
  try {
    const { screenCode } = await context.params;
    const device = await authenticateDevice(request, screenCode);
    if (!device) return apiError("UNAUTHORIZED", "Invalid device token.", 401);

    const manifest = await buildManifest(screenCode);
    if (!manifest) return apiError("SCREEN_NOT_FOUND", "Screen is unavailable.", 404);

    return Response.json(manifest, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
