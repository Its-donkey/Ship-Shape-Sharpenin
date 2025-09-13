// apps/api/src/controllers/customers.ts
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { Request, Response } from "express";
import { parseLoginBody, parseRegisterBody, parseUpdateProfileBody } from "../validators/customerSchemas";
import {
  getCustomerByEmail,
  insertCustomer,
  getCustomerMinimalById,
  getCustomerProfileById,
  updateCustomerProfile,
  listAllCustomers,
  setCustomerPassword,
  findBusinessUniqueId,
  insertBusinessReturnId,
  setCustomerBusinessId,
  setCustomerAdminFlag,
} from "../services/customerService";
  import { normalizeAbn } from "@shipshape/validation";
  import { validatePassword } from "@shipshape/validation";
import { setSessionCookie, SESSIONS } from "../routes/auth";

export async function register(req: Request, res: Response) {
  try {
    const parsed = parseRegisterBody(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
    const { email, password, name, companyName, tradingName, abn, deliveryAddress, billingAddress, phone } =
      parsed.value;

    const existing = getCustomerByEmail(email);
    if (existing) {
      return res
        .status(409)
        .json({ ok: false, message: "An account with this email already exists." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = insertCustomer({
      email,
      password_hash,
      name: name ?? null,
      companyName: companyName ?? null,
      tradingName: tradingName ?? null,
      abn: abn ?? null,
      deliveryAddress: deliveryAddress ?? null,
      billingAddress: billingAddress ?? null,
      phone: phone ?? null,
    });
    // If business details are present, link or create a business_customer row
    const isBusiness = !!(companyName || tradingName || abn);
    if (isBusiness) {
      const abnNorm = abn ? normalizeAbn(abn) : "";
      let bid = findBusinessUniqueId(abnNorm || null, companyName ?? null, tradingName ?? null);
      if (!bid) {
        bid = insertBusinessReturnId({
          abn: abnNorm || null,
          entity_name: companyName ?? null,
          business_name: tradingName ?? null,
          delivery_address: deliveryAddress ?? null,
          billing_address: billingAddress ?? null,
        });
      }
      setCustomerBusinessId(id, bid);
    }

    const minimal = getCustomerMinimalById(id);
    return res.status(201).json({ ok: true, customer: minimal });
  } catch (err) {
    console.error("[customers] register error:", err);
    return res.status(500).json({ ok: false, message: "Registration failed." });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const parsed = parseLoginBody(req.body);
    if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
    const { email, password } = parsed.value;

    let row: any;
    try {
      row = getCustomerByEmail(email);
    } catch (e) {
      console.error("[login] getCustomerByEmail threw:", e);
      return res.status(500).json({ ok: false, message: "DB error (getCustomerByEmail)" });
    }
    if (!row || !row.password_hash || !row.id) {
      return res.status(401).json({ ok: false, message: "Invalid email or password." });
    }

    const disablePw = (String(process.env.DISABLE_PASSWORDS || "").toLowerCase() === "true")
      && !(String(process.env.NODE_ENV).toLowerCase() === "production" && process.env.VITE_DEV_SERVER !== "1");
    let ok = false;
    try {
      ok = disablePw ? true : await bcrypt.compare(password, row.password_hash);
    } catch (e) {
      console.error("[login] bcrypt.compare threw:", e);
      return res.status(500).json({ ok: false, message: "Password check failed" });
    }
    if (!ok) return res.status(401).json({ ok: false, message: "Invalid email or password." });

    const sid = crypto.randomBytes(16).toString("hex");
    SESSIONS.set(sid, row.id);
    setSessionCookie(res, sid);

    let profile: any;
    try {
      profile = getCustomerProfileById(row.id);
    } catch (e) {
      console.error("[login] getCustomerProfileById threw:", e);
      return res.status(500).json({ ok: false, message: "DB error (getCustomerProfileById)" });
    }

    // Normalize flags and reflect ADMIN_EMAILS allowlist for client
    let is_admin = !!profile?.is_admin;
    try {
      if (!is_admin && profile?.email) {
        const allow = String(process.env.ADMIN_EMAILS || "")
          .split(/[\s,]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (allow.length && allow.includes(String(profile.email).toLowerCase())) {
          is_admin = true;
        }
      }
    } catch {}

    return res.json({ ok: true, customer: { ...profile, is_admin } });
  } catch (err) {
    console.error("[login] unexpected error:", err);
    return res.status(500).json({ ok: false, message: "Login failed." });
  }
}

export function me(req: Request, res: Response) {
  try {
    const id = req.customerId as number;
    let customer: any;
    try {
      customer = getCustomerProfileById(id);
    } catch (e) {
      console.error("[me] getCustomerProfileById threw:", e);
      return res.status(500).json({ ok: false, message: "DB error (getCustomerProfileById)" });
    }
    if (!customer) {
      return res.status(401).json({ ok: false, message: "Not signed in." });
    }
    // Ensure booleans are normalized and reflect ADMIN_EMAILS allowlist
    let is_admin = !!customer.is_admin;
    try {
      if (!is_admin && customer.email) {
        const allow = String(process.env.ADMIN_EMAILS || "")
          .split(/[\s,]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (allow.length && allow.includes(String(customer.email).toLowerCase())) {
          is_admin = true;
        }
      }
    } catch {}
    return res.json({ ok: true, customer: { ...customer, is_admin } });
  } catch (e) {
    console.error("[me] unexpected:", e);
    return res.status(500).json({ ok: false, message: "Failed to load profile." });
  }
}

export function updateProfile(req: Request, res: Response) {
  const id = req.customerId as number;
  const parsed = parseUpdateProfileBody(req.body);
  if (!parsed.ok) return res.status(400).json({ ok: false, message: parsed.message });
  const { name, companyName, tradingName, abn, deliveryAddress, billingAddress, phone } = parsed.value;

  updateCustomerProfile(id, {
    name: name ?? null,
    companyName: companyName ?? null,
    tradingName: tradingName ?? null,
    abn: abn ?? null,
    deliveryAddress: deliveryAddress ?? null,
    billingAddress: billingAddress ?? null,
    phone: phone ?? null,
  });

  const updated = getCustomerProfileById(id);
  return res.json({ ok: true, customer: updated });
}

export function listCustomers(_req: Request, res: Response) {
  try {
    const customers = listAllCustomers();
    return res.json({ ok: true, customers });
  } catch (e) {
    console.error("[customers] list error:", e);
    return res.status(500).json({ ok: false, message: "Failed to list customers." });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) return res.status(400).json({ ok: false, message: "Invalid id" });
    const { password } = (req.body || {}) as any;
    if (typeof password !== "string" || !password) return res.status(400).json({ ok: false, message: "Password is required." });
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ ok: false, message: pwErr });
    const password_hash = await bcrypt.hash(password, 10);
    setCustomerPassword(id, password_hash);
    return res.json({ ok: true });
  } catch (e) {
    console.error("[customers] resetPassword error:", e);
    return res.status(500).json({ ok: false, message: "Failed to reset password." });
  }
}

export function setAdminFlag(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) return res.status(400).json({ ok: false, message: "Invalid id" });
    const { is_admin } = (req.body || {}) as any;
    const val = is_admin ? true : false;
    setCustomerAdminFlag(id, val);
    return res.json({ ok: true, id, is_admin: val ? 1 : 0 });
  } catch (e: any) {
    console.error("[customers] setAdminFlag error:", e);
    return res.status(500).json({ ok: false, message: "Failed to update admin flag." });
  }
}

export function setBusinessLink(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) return res.status(400).json({ ok: false, message: "Invalid customer id" });
    const { business_id } = (req.body || {}) as any;
    if (business_id === null || business_id === undefined || business_id === "") {
      setCustomerBusinessId(id, null);
      return res.json({ ok: true, id, business_id: null });
    }
    const bid = Number(business_id);
    if (!Number.isInteger(bid) || bid <= 0) return res.status(400).json({ ok: false, message: "Invalid business id" });
    setCustomerBusinessId(id, bid);
    return res.json({ ok: true, id, business_id: bid });
  } catch (e: any) {
    console.error("[customers] setBusinessLink error:", e);
    return res.status(500).json({ ok: false, message: "Failed to update business link." });
  }
}
