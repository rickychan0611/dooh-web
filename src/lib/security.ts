import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string): string {
  return createHash("sha256")
    .update(`${getEnv().TOKEN_PEPPER}:${value}`)
    .digest("hex");
}

export function fingerprint(value: string): string {
  return createHash("sha256")
    .update(`${getEnv().TOKEN_PEPPER}:fingerprint:${value}`)
    .digest("hex");
}

export function contentHash(title: string, body: string): string {
  return createHash("sha256")
    .update(`${title.trim().toLowerCase()}\n${body.trim().toLowerCase()}`)
    .digest("hex");
}

export function safeHashEquals(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(value));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}
