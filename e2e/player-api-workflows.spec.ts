import { expect, test } from "@playwright/test";

test.describe("player API workflow boundaries", () => {
  test("pairing creation validates device identity before touching storage", async ({
    request,
  }) => {
    const response = await request.post("/api/player/pairing-session", {
      data: { deviceId: "short", appVersion: "" },
    });
    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("visible claim codes cannot be used as private polling tokens", async ({
    request,
  }) => {
    const response = await request.post("/api/player/pairing-session/status", {
      data: { pollToken: "12345678" },
    });
    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("player content endpoint requires a device token", async ({ request }) => {
    const response = await request.get("/api/player/LOBBY/content");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
