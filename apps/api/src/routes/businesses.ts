// apps/api/src/routes/businesses.ts
import { Router } from "express";
import db from "../db/database";
import { requireAdmin } from "./auth";

const router = Router();

// Public: list all businesses with linked customer counts
router.get("/businesses/admin/list", requireAdmin, (_req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT 
           b.id,
           b.abn,
           b.entity_name,
           b.business_name,
           b.delivery_address,
           b.billing_address,
           b.created_at,
           COALESCE(cnt.n_customers, 0) AS n_customers
         FROM business_customer b
         LEFT JOIN (
           SELECT business_id, COUNT(*) AS n_customers
           FROM customers
           WHERE business_id IS NOT NULL
           GROUP BY business_id
         ) AS cnt ON cnt.business_id = b.id
         ORDER BY b.created_at DESC`
      )
      .all() as Array<{
        id: number;
        abn: string | null;
        entity_name: string | null;
        business_name: string | null;
        delivery_address: string | null;
        billing_address: string | null;
        created_at: string;
        n_customers: number;
      }>;

    res.json({ ok: true, businesses: rows });
  } catch (e: any) {
    console.error("[businesses.admin.list] error:", e);
    res.status(500).json({ ok: false, message: e?.message || "Failed to list businesses" });
  }
});

export default router;

// Update business details
router.put("/businesses/:id", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) return res.status(400).json({ ok: false, message: "Invalid id" });
    const { abn, entity_name, business_name, delivery_address, billing_address } = (req.body || {}) as any;
    db.prepare(
      `UPDATE business_customer SET
         abn = COALESCE(@abn, abn),
         entity_name = COALESCE(@entity_name, entity_name),
         business_name = COALESCE(@business_name, business_name),
         delivery_address = COALESCE(@delivery_address, delivery_address),
         billing_address = COALESCE(@billing_address, billing_address)
       WHERE id = @id`
    ).run({ id, abn, entity_name, business_name, delivery_address, billing_address });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to update business" });
  }
});

// ============ Special Pricing ============
function toCents(input: string | number): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(0, Math.round(input * 100));
  const s = String(input || "");
  const m = s.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : null;
}

// List special prices for a business
router.get("/businesses/:id/pricing", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) return res.status(400).json({ ok: false, message: "Invalid id" });
    const rows = db
      .prepare(`SELECT item_number AS itemNumber, price_cents AS priceCents FROM business_pricing WHERE business_id = ? ORDER BY item_number`)
      .all(id) as Array<{ itemNumber: string; priceCents: number }>;
    return res.json({ ok: true, overrides: rows });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to load pricing" });
  }
});

// Upsert a special price for an item
router.post("/businesses/:id/pricing", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) return res.status(400).json({ ok: false, message: "Invalid id" });
    const { itemNumber, price } = (req.body || {}) as { itemNumber?: string; price?: string | number };
    const sku = String(itemNumber || "").trim();
    if (!sku) return res.status(400).json({ ok: false, message: "itemNumber is required" });
    const cents = toCents(price as any);
    if (cents == null) return res.status(400).json({ ok: false, message: "price invalid" });
    db.prepare(
      `INSERT INTO business_pricing (business_id, item_number, price_cents, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`
    ).run(id, sku, cents);
    return res.json({ ok: true, itemNumber: sku, priceCents: cents });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to save price" });
  }
});

// Remove a special price
router.delete("/businesses/:id/pricing/:itemNumber", requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isFinite(id)) return res.status(400).json({ ok: false, message: "Invalid id" });
    const sku = String(req.params.itemNumber || "").trim();
    if (!sku) return res.status(400).json({ ok: false, message: "itemNumber is required" });
    const info = db.prepare(`DELETE FROM business_pricing WHERE business_id = ? AND item_number = ?`).run(id, sku);
    return res.json({ ok: true, deleted: info.changes || 0 });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: e?.message || "Failed to delete price" });
  }
});
