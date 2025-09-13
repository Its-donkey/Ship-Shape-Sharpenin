// apps/api/src/routes/tlds.ts
import { Router } from "express";
import { db } from "../db/database";
import { runTldIngestOnce } from "../jobs/tldCron";
import { requireAdmin } from "./auth";

const router = Router();

router.get("/summary", (_req, res) => {
  try {
    const last = db.prepare(`SELECT MAX(date_added) AS lastDate FROM tlds`).get() as
      | { lastDate?: string }
      | undefined;
    const cnt = db
      .prepare(`SELECT COUNT(*) AS count FROM tlds WHERE active = 1`)
      .get() as { count?: number } | undefined;
    const lastDate = last?.lastDate || null;
    const count = cnt?.count ?? 0;
    return res.json({ ok: true, lastDate, count });
  } catch (e) {
    console.error("[tlds] summary error:", e);
    return res.status(500).json({ ok: false, message: "Failed to load TLD summary" });
  }
});

router.post("/clear", requireAdmin, (_req, res) => {
  try {
    const info = db.prepare(`DELETE FROM tlds`).run();
    return res.json({ ok: true, deleted: info.changes || 0 });
  } catch (e) {
    console.error("[tlds] clear error:", e);
    return res.status(500).json({ ok: false, message: "Failed to clear TLDs" });
  }
});

router.post("/update", requireAdmin, async (_req, res) => {
  try {
    await runTldIngestOnce();
    return res.json({ ok: true });
  } catch (e) {
    console.error("[tlds] update error:", e);
    return res.status(500).json({ ok: false, message: "Failed to update TLDs" });
  }
});

export default router;
