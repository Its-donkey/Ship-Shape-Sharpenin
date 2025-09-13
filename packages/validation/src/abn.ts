//packages/validation/src/abn.ts

import type { Validator } from "./common";

/**
 * Returns true if the given ABN string passes the official checksum.
 * - Ignores spaces in input.
 * - Requires exactly 11 digits after stripping spaces.
 */
export function abnIsValid(abn: string | null | undefined): boolean {
  if (!abn) return false;
  // Remove all non-digits; only validate once we have exactly 11 digits
  const digits = (abn ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return false;

  // Convert to numbers, subtract 1 from the first digit
  const arr = digits.split("").map((d) => Number(d));
  arr[0] = arr[0] - 1;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = arr.reduce((acc, d, i) => acc + d * weights[i], 0);
  return sum % 89 === 0;
}

/**
 * Validator that allows empty (optional) and enforces checksum when provided.
 * Returns null when valid or a human-friendly message when invalid.
 */
export const validateAbn: Validator<string> = (value) => {
  if (!value) return null; // optional
  return abnIsValid(value) ? null : "Please enter a valid ABN (11 digits).";
};

/** Remove all non-digits from an ABN string. */
export function normalizeAbn(input: string | null | undefined): string {
  // Keep only digits and cap to 11
  return (input ?? "").replace(/\D/g, "").slice(0, 11);
}

/**
 * Format an ABN as "XX XXX XXX XXX" while typing.
 * - Accepts any input, strips non-digits and groups 2-3-3-3.
 * - Returns partial group spacing for shorter inputs.
 */
export function formatAbn(input: string | null | undefined): string {
  const d = normalizeAbn(input);
  const groups = [2, 3, 3, 3];
  let i = 0;
  let out = "";
  for (const g of groups) {
    if (i >= d.length) break;
    const next = d.slice(i, i + g);
    if (!next) break;
    if (out) out += " ";
    out += next;
    i += next.length;
  }
  return out || d;
}
