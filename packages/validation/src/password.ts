import type { Validator } from "./common";

export const minPasswordLength =
  (n: number): Validator<string> =>
  (v) =>
    v.length >= n ? null : `Must be at least ${n} characters.`;

export const requireUpper: Validator<string> = (v) =>
  /[A-Z]/.test(v) ? null : "Must include an uppercase letter.";

export const requireDigit: Validator<string> = (v) =>
  /\d/.test(v) ? null : "Must include a number.";

export const requireSpecial: Validator<string> = (v) =>
  /[^A-Za-z0-9]/.test(v) ? null : "Must include a special character.";

export const validatePassword: Validator<string> = (pw) => {
  if (!pw) return "Password is required.";
  const rules = [minPasswordLength(8), requireUpper, requireDigit];
  for (const r of rules) {
    const err = r(pw);
    if (err) return err;
  }
  return null;
};
