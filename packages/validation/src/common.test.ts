//packages/validation/src/common.test.ts

import { describe, it, expect } from "vitest";
import { required, minLength, maxLength, combineValidators, isNonEmpty } from "./common";

describe("common validators", () => {
  it("required passes non-empty and fails empty", () => {
    expect(required()("a")).toBeNull();
    expect(required()("")).toMatch(/required/);
  });

  it("minLength and maxLength enforce bounds", () => {
    expect(minLength(3)("abc")).toBeNull();
    expect(minLength(3)("ab")).toMatch(/at least 3/);
    expect(maxLength(3)("abc")).toBeNull();
    expect(maxLength(3)("abcd")).toMatch(/at most 3/);
  });

  it("combineValidators returns first error", () => {
    const v = combineValidators(required(), minLength(3));
    expect(v(""))
      .toBeTypeOf("string");
    expect(v("ab")).toMatch(/at least 3/);
    expect(v("abc")).toBeNull();
  });

  it("isNonEmpty returns true only for non-whitespace", () => {
    expect(isNonEmpty(" hi ")).toBe(true);
    expect(isNonEmpty("\n\t ")).toBe(false);
    expect(isNonEmpty("")).toBe(false);
  });
});
