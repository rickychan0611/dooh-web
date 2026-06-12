import { apiError, handleApiError } from "@/lib/http";
import { authenticateDevice, createQrSession } from "@/lib/player";

export async function GET(
  request: Request,
  context: { params: Promise<{ screenCode: string }> },
) {
  try {
    const { screenCode } = await context.params;
    const device = await authenticateDevice(request, screenCode);
    if (!device) return apiError("UNAUTHORIZED", "Invalid device token.", 401);
    return Response.json(await createQrSession(device.screen_id, screenCode));
  } catch (error) {
    return handleApiError(error);
  }
}
