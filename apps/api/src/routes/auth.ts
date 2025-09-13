// apps/api/src/routes/auth.ts
import { Router } from "express";
import { stmts, db } from "../db/database";
import crypto from "node:crypto";

const router = Router();

// --- Session handling (dev: in-memory) ---
export const SESSIONS = new Map<string, number>(); // sid -> customerId

function setSessionCookie(res: any, sid: string) {
  const raw = String(process.env.COOKIE_SECURE ?? "").trim().toLowerCase();
  const secure =
    raw === "true"
      ? true
      : raw === "false"
      ? false
      : process.env.NODE_ENV === "production" && process.env.VITE_DEV_SERVER !== "1";
  res.cookie("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    path: "/",
  });
}

export function requireSession(req: any, res: any, next: any) {
  const sid = req.cookies?.sid;
  if (!sid)
    return res.status(401).json({ ok: false, message: "Not signed in." });
  const customerId = SESSIONS.get(sid);
  if (!customerId)
    return res.status(401).json({ ok: false, message: "Not signed in." });
  req.customerId = customerId;
  next();
}

/** Admin middleware using ADMIN_EMAILS env (comma-separated) */
export function requireAdmin(req: any, res: any, next: any) {
  try {
    const sid = req.cookies?.sid;
    if (!sid) return res.status(401).json({ ok: false, message: "Not signed in." });
    const customerId = SESSIONS.get(sid);
    if (!customerId) return res.status(401).json({ ok: false, message: "Not signed in." });
    const row = db
      .prepare(`SELECT email, is_admin FROM customers WHERE id = ?`)
      .get(customerId) as { email?: string; is_admin?: number } | undefined;

    // Allow either DB flag or ADMIN_EMAILS env fallback
    let isAdmin = !!row?.is_admin;
    if (!isAdmin && row?.email) {
      const list = String(process.env.ADMIN_EMAILS || "")
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (list.length && list.includes(row.email.toLowerCase())) {
        isAdmin = true;
      }
    }
    if (!isAdmin) return res.status(403).json({ ok: false, message: "Admin access required." });
    req.customerId = customerId;
    next();
  } catch (e) {
    return res.status(500).json({ ok: false, message: "Admin check failed" });
  }
}

/** Trade middleware: requires valid session + customer.is_trade = 1 */
export function requireTrade(req: any, res: any, next: any) {
  try {
    const sid = req.cookies?.sid;
    if (!sid) return res.status(401).json({ ok: false, message: "Not signed in." });
    const customerId = SESSIONS.get(sid);
    if (!customerId) return res.status(401).json({ ok: false, message: "Not signed in." });
    const row = db
      .prepare(`SELECT is_trade FROM customers WHERE id = ?`)
      .get(customerId) as { is_trade?: number } | undefined;
    if (!row || !row.is_trade) {
      return res.status(403).json({ ok: false, message: "Trade access required." });
    }
    req.customerId = customerId;
    next();
  } catch (e) {
    return res.status(500).json({ ok: false, message: "Trade check failed" });
  }
}

/** POST /api/auth/logout — clear cookie + session */
router.post("/auth/logout", (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) SESSIONS.delete(sid);
  res.clearCookie("sid", { path: "/" });
  res.json({ ok: true });
});

/** POST /api/auth/devlogin — quick dev session without password */
router.post("/auth/devlogin", (req, res) => {
  // Restrict devlogin to non-production or explicit dev server
  const isProd = String(process.env.NODE_ENV).toLowerCase() === "production" && process.env.VITE_DEV_SERVER !== "1";
  if (isProd) return res.status(403).json({ ok: false, message: "Dev login disabled in production" });
  const { id } = (req.body ?? {}) as { id?: number };
  const customerId = Number.isInteger(id) ? Number(id) : 1;

  const sid = crypto.randomBytes(16).toString("hex");
  SESSIONS.set(sid, customerId);
  setSessionCookie(res, sid);

  return res.json({ ok: true, sid, customerId });
});

export { setSessionCookie };
export default router;
