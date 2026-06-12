import { describe, expect, it } from "vitest";
import { parsePostNumberSearch } from "./posts";

describe("post number search", () => {
  it("accepts plain and hash-prefixed numbers", () => {
    expect(parsePostNumberSearch("12")).toBe(12);
    expect(parsePostNumberSearch(" #12 ")).toBe(12);
  });

  it("rejects invalid and non-positive values", () => {
    expect(parsePostNumberSearch("post 12")).toBeNull();
    expect(parsePostNumberSearch("0")).toBeNull();
  });
});
