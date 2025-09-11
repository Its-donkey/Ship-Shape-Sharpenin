/** Return `null` when valid, or a human-readable error message when invalid. */
export type Validator<T = string> = (value: T) => string | null;

/** Compose multiple validators; returns the first error or null. */
export function combineValidators<T = string>(
  ...validators: Validator<T>[]
): Validator<T> {
  return (v: T) => {
    for (const fn of validators) {
      const err = fn(v);
      if (err) return err;
    }
    return null;
  };
}

/** Helpers to build small validators */
export const required =
  (label = "This field"): Validator<string> =>
  (v) =>
    v && v.toString().trim().length > 0 ? null : `${label} is required.`;

export const minLength =
  (n: number, label = "This field"): Validator<string> =>
  (v) =>
    (v ?? "").length >= n ? null : `${label} must be at least ${n} characters.`;

export const maxLength =
  (n: number, label = "This field"): Validator<string> =>
  (v) =>
    (v ?? "").length <= n ? null : `${label} must be at most ${n} characters.`;
