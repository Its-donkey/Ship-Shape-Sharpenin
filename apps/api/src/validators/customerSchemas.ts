// apps/api/src/validators/customerSchemas.ts
import {
  abnIsValid,
  normalizeAbn,
  validateEmail,
  validatePassword,
} from "@shipshape/validation";

export type RegisterBody = {
  email: string;
  password: string;
  name: string;
  companyName: string | null;
  tradingName: string | null;
  abn: string; // normalized 11 digits
  deliveryAddress: string | null;
  billingAddress: string | null;
  phone: string | null;
};

export type LoginBody = { email: string; password: string };

export type UpdateProfileBody = {
  name: string | null;
  companyName: string | null;
  tradingName: string | null;
  abn: string; // normalized 11 digits or empty when not provided
  deliveryAddress: string | null;
  billingAddress: string | null;
  phone: string | null;
};

function isValidPhone(phone?: string) {
  if (!phone) return true;
  return /^[\d\s()+-]{6,}$/.test(phone);
}

export function parseRegisterBody(body: any):
  | { ok: true; value: RegisterBody }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "Invalid request body" };

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const companyName = body.companyName ? String(body.companyName).trim() : null;
  const tradingName = body.tradingName ? String(body.tradingName).trim() : null;
  const abnRaw = String(body.abn ?? "");
  const deliveryAddress = body.deliveryAddress ? String(body.deliveryAddress).trim() : null;
  const billingAddress = body.billingAddress ? String(body.billingAddress).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;

  if (validateEmail(email)) return { ok: false, message: "Enter a valid email address." };
  const pwErr = validatePassword(password);
  if (pwErr) return { ok: false, message: pwErr };
  if (name.length < 2) return { ok: false, message: "Name must be at least 2 characters." };

  // ABN is optional at registration time. If provided, it must be valid.
  const abnNormalized = normalizeAbn(abnRaw);
  if (abnNormalized && !abnIsValid(abnNormalized)) {
    return { ok: false, message: "Please enter a valid ABN." };
  }
  if (!isValidPhone(phone ?? undefined))
    return { ok: false, message: "Please provide a valid phone number." };

  return {
    ok: true,
    value: {
      email,
      password,
      name,
      companyName,
      tradingName,
      abn: abnNormalized,
      deliveryAddress,
      billingAddress,
      phone,
    },
  };
}

export function parseLoginBody(body: any):
  | { ok: true; value: LoginBody }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "Invalid request body" };
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (validateEmail(email)) return { ok: false, message: "Enter a valid email address." };
  const disablePw = (String(process.env.DISABLE_PASSWORDS || "").toLowerCase() === "true")
    && !(String(process.env.NODE_ENV).toLowerCase() === "production" && process.env.VITE_DEV_SERVER !== "1");
  if (!disablePw && !password) return { ok: false, message: "Password is required." };
  return { ok: true, value: { email, password } };
}

export function parseUpdateProfileBody(body: any):
  | { ok: true; value: UpdateProfileBody }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "Invalid request body" };
  const name = body.name ? String(body.name).trim() : null;
  const companyName = body.companyName ? String(body.companyName).trim() : null;
  const tradingName = body.tradingName ? String(body.tradingName).trim() : null;
  const abnRaw = String(body.abn ?? "");
  const deliveryAddress = body.deliveryAddress ? String(body.deliveryAddress).trim() : null;
  const billingAddress = body.billingAddress ? String(body.billingAddress).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;

  const abn = normalizeAbn(abnRaw);
  // ABN is optional on profile; only validate checksum when provided
  if (abn && !abnIsValid(abn)) return { ok: false, message: "Please enter a valid ABN." };
  if (!isValidPhone(phone ?? undefined))
    return { ok: false, message: "Please provide a valid phone number." };

  return {
    ok: true,
    value: { name, companyName, tradingName, abn, deliveryAddress, billingAddress, phone },
  };
}
