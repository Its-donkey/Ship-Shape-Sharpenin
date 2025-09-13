//packages/validation/src/name.ts

import type { Validator } from "./common";

/** Generic name validation: required and min length 2 */
export const validateName: Validator<string> = (name) => {
  if (!name || name.trim().length === 0) return "Name is required.";
  if (name.trim().length < 2) return "Name is too short.";
  return null;
};

/** Build a name validator with a custom field label in messages */
export function makeNameValidator(label: string): Validator<string> {
  return (value: string) => {
    if (!value || value.trim().length === 0) return `${label} is required.`;
    if (value.trim().length < 2) return `${label} is too short.`;
    return null;
  };
}

export const validateFirstName: Validator<string> = makeNameValidator("First name");
export const validateLastName: Validator<string> = makeNameValidator("Last name");
