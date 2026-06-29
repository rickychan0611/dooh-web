import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.PLATFORM_OWNER_EMAILS = "owner@example.com";
  process.env.TOKEN_PEPPER = "token-pepper-with-enough-length";
  process.env.PAIRING_TOKEN_ENCRYPTION_KEY =
    "pairing-encryption-key-with-enough-length";
});

describe("pairing token encryption", () => {
  it("round trips a device token without storing plaintext", async () => {
    const { decryptPairingToken, encryptPairingToken } = await import(
      "./pairing-crypto"
    );
    const token = "device-token-value";
    const encrypted = encryptPairingToken(token);

    expect(encrypted).not.toContain(token);
    expect(decryptPairingToken(encrypted)).toBe(token);
  });

  it("rejects tampered ciphertext", async () => {
    const { decryptPairingToken, encryptPairingToken } = await import(
      "./pairing-crypto"
    );
    const encrypted = encryptPairingToken("device-token-value");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptPairingToken(tampered)).toThrow();
  });
});
