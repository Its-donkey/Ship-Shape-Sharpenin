// apps/api/src/routes/customers.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import { db, stmts } from "../db/client";
import { requireSession, setSessionCookie, SESSIONS } from "./auth";
import crypto from "node:crypto";

const router = Router();

/** ABN checksum validator (11 digits, modulo 89) */
function isValidAbn(abn?: string) {
  if (!abn) return true;
  const digits = abn.replace(/\s+/g, "").split("").map(Number);
  if (digits.length !== 11 || digits.some(Number.isNaN)) return false;
  digits[0] = digits[0] - 1;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  return sum % 89 === 0;
}
function isValidPhone(phone?: string) {
  if (!phone) return true;
  return /^[\d\s()+-]{6,}$/.test(phone);
}

/** POST /api/customers/register */
router.post("/customers/register", async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      companyName,
      tradingName,
      abn,
      deliveryAddress,
      billingAddress,
      phone,
    } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password are required." });
    }
    if (!isValidAbn(abn)) {
      return res
        .status(400)
        .json({ ok: false, message: "Please enter a valid ABN." });
    }
    if (!isValidPhone(phone)) {
      return res
        .status(400)
        .json({ ok: false, message: "Please provide a valid phone number." });
    }

    const existing = stmts.getCustomerByEmail.get(email);
    if (existing) {
      return res
        .status(409)
        .json({
          ok: false,
          message: "An account with this email already exists.",
        });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const info = stmts.insertCustomer.run({
      email,
      password_hash,
      name: name ?? null,
      company_name: companyName ?? null,
      trading_name: tradingName ?? null,
      abn: abn ?? null,
      delivery_addr: deliveryAddress ?? null,
      billing_addr: billingAddress ?? null,
      phone: phone ?? null,
    });

    const id = Number(info.lastInsertRowid);
    const minimal = stmts.getCustomerById.get(id);
    return res.status(201).json({ ok: true, customer: minimal });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ ok: false, message: "Registration failed." });
  }
});

/** POST /api/customers/login — validates password, sets sid cookie */
/** POST /api/customers/login — validates password, sets sid cookie */
router.post("/customers/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Email and password are required." });
    }

    console.log("[login] body.email:", email);

    let row: any;
    try {
      row = stmts.getCustomerByEmail.get(email);
      console.log("[login] row keys:", row && Object.keys(row));
    } catch (e) {
      console.error("[login] getCustomerByEmail threw:", e);
      return res.status(500).json({ ok: false, message: "DB error (getCustomerByEmail)" });
    }

    if (!row || !row.password_hash || !row.id) {
      console.warn("[login] missing row/password_hash/id");
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password." });
    }

    let ok = false;
    try {
      ok = await bcrypt.compare(password, row.password_hash);
    } catch (e) {
      console.error("[login] bcrypt.compare threw:", e);
      return res.status(500).json({ ok: false, message: "Password check failed" });
    }
    if (!ok) {
      console.warn("[login] password mismatch");
      return res
        .status(401)
        .json({ ok: false, message: "Invalid email or password." });
    }

    const sid = crypto.randomBytes(16).toString("hex");
    SESSIONS.set(sid, row.id);
    setSessionCookie(res, sid);

    let profile: any;
    try {
      profile = stmts.getCustomerProfileById.get(row.id);
      console.log("[login] profile keys:", profile && Object.keys(profile));
    } catch (e) {
      console.error("[login] getCustomerProfileById threw:", e);
      return res.status(500).json({ ok: false, message: "DB error (getCustomerProfileById)" });
    }

    return res.json({ ok: true, customer: profile });
  } catch (err) {
    console.error("[login] unexpected error:", err);
    return res.status(500).json({ ok: false, message: "Login failed." });
  }
});

/** GET /api/customers/me — requires valid session */
router.get("/customers/me", requireSession, (req, res) => {
  try {
    const id = req.customerId as number;
    console.log("[me] req.customerId:", id);
    let customer: any;
    try {
      customer = stmts.getCustomerProfileById.get(id);
      console.log("[me] profile keys:", customer && Object.keys(customer));
    } catch (e) {
      console.error("[me] getCustomerProfileById threw:", e);
      return res.status(500).json({ ok: false, message: "DB error (getCustomerProfileById)" });
    }
    if (!customer) {
      return res.status(401).json({ ok: false, message: "Not signed in." });
    }
    return res.json({ ok: true, customer });
  } catch (e) {
    console.error("[me] unexpected:", e);
    return res.status(500).json({ ok: false, message: "Failed to load profile." });
  }
});

/** PUT /api/customers/profile — update FULL profile */
router.put("/customers/profile", requireSession, (req, res) => {
  const id = req.customerId as number;
  const {
    name,
    companyName,
    tradingName,
    abn,
    deliveryAddress,
    billingAddress,
    phone,
  } = req.body || {};

  if (!isValidAbn(abn)) {
    return res
      .status(400)
      .json({ ok: false, message: "Please enter a valid ABN." });
  }
  if (!isValidPhone(phone)) {
    return res
      .status(400)
      .json({ ok: false, message: "Please provide a valid phone number." });
  }

  db.prepare(
    `
    UPDATE customers SET
      name          = @name,
      company_name  = @companyName,
      trading_name  = @tradingName,
      abn           = @abn,
      delivery_addr = @deliveryAddress,
      billing_addr  = @billingAddress,
      phone         = @phone
    WHERE id = @id
  `
  ).run({
    id,
    name: name ?? null,
    companyName: companyName ?? null,
    tradingName: tradingName ?? null,
    abn: abn ?? null,
    deliveryAddress: deliveryAddress ?? null,
    billingAddress: billingAddress ?? null,
    phone: phone ?? null,
  });

  const updated = stmts.getCustomerProfileById.get(id);
  res.json({ ok: true, customer: updated });
});

export default router;
