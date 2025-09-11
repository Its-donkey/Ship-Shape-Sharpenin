import type { Validator } from "./common";

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const validateEmail: Validator<string> = (email) => {
  if (!email) return "Email is required.";
  return EMAIL_RE.test(email) ? null : "Enter a valid email address.";
};
