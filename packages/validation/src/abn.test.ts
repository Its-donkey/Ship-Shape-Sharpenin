//packages/validation/src/abn.test.ts

import { describe, it, expect } from "vitest";
import { abnIsValid, validateAbn, formatAbn, normalizeAbn } from "./abn";

// Some known-valid ABNs (from public examples)
const VALID_ABNS = [
  "51824753556", // ATO example
  "53004085616",
];

describe("ABN validation", () => {
  it("accepts known valid ABNs", () => {
    for (const abn of VALID_ABNS) {
      expect(abnIsValid(abn)).toBe(true);
    }
  });

  it("rejects invalid checksums and lengths", () => {
    expect(abnIsValid("12345678901")).toBe(false);
    expect(abnIsValid("123")).toBe(false);
    expect(abnIsValid("")).toBe(false);
  });

  it("allows spaces in input", () => {
    expect(abnIsValid("53 004 085 616")).toBe(true);
  });

  it("validateAbn allows empty but flags invalid", () => {
    expect(validateAbn("")).toBeNull();
    expect(validateAbn("notanabn")).toMatch(/valid ABN/);
  });

  it("normalizeAbn strips non-digits", () => {
    expect(normalizeAbn("53 004-085.616")).toBe("53004085616");
  });

  it("normalizeAbn caps at 11 digits", () => {
    expect(normalizeAbn("5300408561600")).toBe("53004085616");
  });

  it("formatAbn groups 2-3-3-3 with partials", () => {
    expect(formatAbn("5")).toBe("5");
    expect(formatAbn("53")).toBe("53");
    expect(formatAbn("530")).toBe("53 0");
    expect(formatAbn("53004")).toBe("53 004");
    expect(formatAbn("530040")).toBe("53 004 0");
    expect(formatAbn("53004085616")).toBe("53 004 085 616");
    // Extra digits beyond 11 are ignored
    expect(formatAbn("5300408561600")).toBe("53 004 085 616");
  });
});
