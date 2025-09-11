// apps/api/src/routes/auth.ts
import { Router } from "express";
import crypto from "node:crypto";

const router = Router();

// --- Session handling (dev: in-memory) ---
export const SESSIONS = new Map<string, number>(); // sid -> customerId

function setSessionCookie(res: any, sid: string) {
  res.cookie("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // set true behind HTTPS
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

/** POST /api/auth/logout — clear cookie + session */
router.post("/auth/logout", (req, res) => {
  const sid = req.cookies?.sid;
  if (sid) SESSIONS.delete(sid);
  res.clearCookie("sid", { path: "/" });
  res.json({ ok: true });
});

/** POST /api/auth/devlogin — quick dev session without password */
router.post("/auth/devlogin", (req, res) => {
  const { id } = (req.body ?? {}) as { id?: number };
  const customerId = Number.isInteger(id) ? Number(id) : 1;

  const sid = crypto.randomBytes(16).toString("hex");
  SESSIONS.set(sid, customerId);
  setSessionCookie(res, sid);

  return res.json({ ok: true, sid, customerId });
});

export { setSessionCookie };
export default router;
