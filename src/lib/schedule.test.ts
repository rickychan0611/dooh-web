import { describe, expect, it } from "vitest";
import { isPlaylistItemActive } from "./schedule";

describe("playlist scheduling", () => {
  it("honors active state and absolute date bounds", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    expect(isPlaylistItemActive({ is_active: false }, now, "UTC")).toBe(false);
    expect(
      isPlaylistItemActive(
        {
          starts_at: "2026-06-15T11:00:00.000Z",
          ends_at: "2026-06-15T13:00:00.000Z",
        },
        now,
        "UTC",
      ),
    ).toBe(true);
    expect(
      isPlaylistItemActive(
        { starts_at: "2026-06-15T13:00:00.000Z" },
        now,
        "UTC",
      ),
    ).toBe(false);
  });

  it("filters weekdays in the configured timezone", () => {
    const monday = new Date("2026-06-15T12:00:00.000Z");
    expect(
      isPlaylistItemActive({ weekdays: [1] }, monday, "UTC"),
    ).toBe(true);
    expect(
      isPlaylistItemActive({ weekdays: [2] }, monday, "UTC"),
    ).toBe(false);
  });

  it("supports normal and overnight daily windows", () => {
    const noon = new Date("2026-06-15T12:00:00.000Z");
    const late = new Date("2026-06-15T23:30:00.000Z");
    expect(
      isPlaylistItemActive(
        { start_time: "09:00:00", end_time: "17:00:00" },
        noon,
        "UTC",
      ),
    ).toBe(true);
    expect(
      isPlaylistItemActive(
        { start_time: "22:00:00", end_time: "02:00:00" },
        late,
        "UTC",
      ),
    ).toBe(true);
  });
});
