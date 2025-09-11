import type { Validator } from "./common";

export const validateName: Validator<string> = (name) => {
  if (!name) return "Name is required.";
  if (name.trim().length < 2) return "Name is too short.";
  return null;
};
