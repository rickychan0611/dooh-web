import { describe, expect, it } from "vitest";
import { containsBlockedWord } from "./moderation-core";

describe("containsBlockedWord", () => {
  it("matches configured terms case-insensitively", () => {
    expect(containsBlockedWord("Community Update", "No SPAM here", ["spam"])).toBe(true);
  });

  it("ignores empty configured terms", () => {
    expect(containsBlockedWord("Hello", "World", ["", "  "])).toBe(false);
  });
});
