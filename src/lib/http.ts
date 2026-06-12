import { ZodError } from "zod";

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return Response.json({ error: { code, message, details } }, { status });
}

export function handleApiError(error: unknown) {
  console.error(error);
  if (error instanceof ZodError) {
    return apiError("VALIDATION_ERROR", "Request validation failed.", 422, error.issues);
  }
  return apiError("INTERNAL_ERROR", "Unexpected server error.", 500);
}
