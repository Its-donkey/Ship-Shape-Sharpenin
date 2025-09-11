import type { Validator } from "./common";

/** Basic international phone sanity check; adapt as needed for AU formats */
const PHONE_MIN_DIGITS = 8;

export const validatePhone: Validator<string> = (phone) => {
  if (!phone) return "Phone is required.";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < PHONE_MIN_DIGITS) return "Enter a valid phone number.";
  return null;
};
