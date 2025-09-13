//apps/api/src/routes/items.ts

// server/routes/items.ts
import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import db, {
  stmtUpsertItem,
  stmtGetAllItems,
  stmtGetCompact,
  valuesFromRowFlexible,
  stmtLogPriceUpload,
  sydneyNowSql,
} from "../db/database";
import { TextDecoder } from "util";
import { requireAdmin } from "./auth";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ---------- decode helpers (UTF-8 / UTF-16 / BOM safe) ----------
function decodeBufferSmart(buf: Buffer): string {
  // UTF-8 BOM?
  if (
    buf.length >= 3 &&
    buf[0] === 0xef &&
    buf[1] === 0xbb &&
    buf[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(buf.subarray(3));
  }
  // UTF-16 LE BOM?
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    try {
      return new TextDecoder("utf-16le")
        .decode(buf.subarray(2))
        .replace(/^\uFEFF/, "");
    } catch {}
  }
  // UTF-16 BE BOM?
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    try {
      return new TextDecoder("utf-16be")
        .decode(buf.subarray(2))
        .replace(/^\uFEFF/, "");
    } catch {}
  }
  // Try sniff 0x00 pattern (likely UTF-16)
  if (buf.length > 4 && (buf[1] === 0x00 || buf[0] === 0x00)) {
    try {
      // heuristics: try LE first
      return new TextDecoder("utf-16le").decode(buf).replace(/^\uFEFF/, "");
    } catch {}
    try {
      return new TextDecoder("utf-16be").decode(buf).replace(/^\uFEFF/, "");
    } catch {}
  }
  const s = new TextDecoder("utf-8").decode(buf);
  return s.replace(/^\uFEFF/, "");
}

// ---------- helpers ----------
function normalizeNewlines(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
function stripBOM(s: string) {
  return s.replace(/^\uFEFF/, "");
}
function firstNonEmptyLine(text: string): string {
  for (const line of normalizeNewlines(text).split("\n")) {
    if (line.trim() !== "") return line;
  }
  return "";
}

/** Detect delimiter from a header line: prefer tab if present, else comma */
function detectDelimiter(headerLine: string): "\t" | "," {
  return headerLine.includes("\t") ? "\t" : ",";
}

/** Very small CSV/TSV splitter (no quoted-field complexity needed for MYOB export) */
function splitSimple(line: string, delim: string): string[] {
  return line.split(delim).map((c) => c);
}

/** Parse a delimited block into 2D array of strings */
function parseDelimited(text: string, delim: string): string[][] {
  const out: string[][] = [];
  const lines = normalizeNewlines(text).split("\n");
  for (const raw of lines) {
    const line = stripBOM(raw);
    if (line.trim() === "") continue;
    out.push(splitSimple(line, delim));
  }
  return out;
}

/** Items parser that:
 *  - normalizes newlines
 *  - drops leading BOM
 *  - ignores a stray first line exactly "{}"
 *  - returns array of objects using header row as keys
 */
function parseItemsBuffer(buf: Buffer): Array<Record<string, string>> {
  const decoded = decodeBufferSmart(buf);
  const lines = normalizeNewlines(decoded).split("\n");

  // Drop leading empties
  while (lines.length && lines[0].trim() === "") lines.shift();
  // Drop a stray "{}" top line
  if (lines.length && lines[0].trim() === "{}") lines.shift();
  while (lines.length && lines[0].trim() === "") lines.shift();

  const cleaned = lines
    .map((l) => stripBOM(l))
    .filter((l) => l.trim() !== "")
    .join("\n")
    .trimEnd();

  if (!cleaned) return [];
  const first = cleaned.split("\n", 1)[0];
  const delim = detectDelimiter(first);
  const rows = parseDelimited(cleaned, delim);
  if (rows.length <= 1) return [];

  const headers = rows[0].map((h) => stripBOM(h).trim());
  const out: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.every((c) => c.trim() === "")) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    out.push(obj);
  }
  return out;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Find a base folder (DATA_DIR env, then nearest 'server' or 'api', else fallback) and ensure data/pricelists */
function resolveDataDirs() {
  // 1) Highest priority: explicit env override
  const envDir = process.env.DATA_DIR?.trim();
  if (envDir) {
    const baseDir = path.resolve(envDir);
    const dataDir = path.join(baseDir, "data"); // allow DATA_DIR=/mount -> /mount/data
    const pricelistsDir = path.join(dataDir, "pricelists");
    ensureDir(dataDir);
    ensureDir(pricelistsDir);
    return { baseDir, dataDir, pricelistsDir };
  }

  // 2) Try to find a nearby folder named 'server' or 'api'
  let dir = __dirname;
  let baseDir: string | null = null;
  while (dir !== path.dirname(dir)) {
    const name = path.basename(dir);
    if (name === "server" || name === "api") {
      baseDir = dir;
      break;
    }
    dir = path.dirname(dir);
  }

  // 3) Fallback: repo-local ../../data relative to this file
  if (!baseDir) {
    baseDir = path.resolve(__dirname, "../../"); // e.g. server/.. (or apps/api/src/..)
  }

  const dataDir = path.join(baseDir, "data");
  const pricelistsDir = path.join(dataDir, "pricelists");
  ensureDir(dataDir);
  ensureDir(pricelistsDir);
  return { baseDir, dataDir, pricelistsDir };
}

// ---------- Import rules (JSON file in data dir) ----------------------------
type ImportRules = { itemNumberPrefixes?: string[] };
function rulesPath(): string {
  const { dataDir } = resolveDataDirs();
  return path.join(dataDir, "import-rules.json");
}
function loadImportRules(): ImportRules {
  try {
    const p = rulesPath();
    if (!fs.existsSync(p)) return { itemNumberPrefixes: [] };
    const raw = fs.readFileSync(p, "utf8");
    const json = JSON.parse(raw);
    const arr = Array.isArray(json?.itemNumberPrefixes) ? json.itemNumberPrefixes : [];
    return { itemNumberPrefixes: arr.filter((s: any) => typeof s === "string").map((s: string) => s.trim()).filter(Boolean) };
  } catch {
    return { itemNumberPrefixes: [] };
  }
}
function saveImportRules(rules: ImportRules): void {
  const p = rulesPath();
  fs.writeFileSync(p, JSON.stringify({ itemNumberPrefixes: rules.itemNumberPrefixes ?? [] }, null, 2), "utf8");
}

// YYYY-MM-DD-hhmm in Australia/Sydney for filenames
function tsForFilename(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
}

// ---------- routes ----------
router.post("/upload", requireAdmin, upload.single("file"), (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ ok: false, error: "No file uploaded" });

    const { originalname, size, buffer, mimetype } = req.file;
    const allowed = [
      "text/plain",
      "text/csv",
      "application/json",
      "text/tab-separated-values",
    ];
    if (mimetype && !allowed.includes(mimetype)) {
      // allow unknowns; warn but continue
      console.warn(`[items.upload] unexpected mimetype: ${mimetype}`);
    }
    const decoded = decodeBufferSmart(buffer);
    const firstLine = firstNonEmptyLine(decoded);

    // Parse rows (keep all headers/columns as-is)
    const rows = parseItemsBuffer(buffer);
    if (rows.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No rows parsed from file",
        firstLine: firstLine.slice(0, 120),
      });
    }

    // Load dynamic import rules
    const rules = loadImportRules();
    const prefixes = (rules.itemNumberPrefixes ?? []).map((s) => s.toUpperCase());

    // Upsert into DB (valuesFromRowFlexible handles aliasing to ITEM_COLS)
    let upserted = 0;
    const tx = db.transaction((all: Array<Record<string, string>>) => {
      for (const obj of all) {
        const vals = valuesFromRowFlexible(obj);
        const itemNumber = String(vals[0] || "").trim();
        if (!itemNumber) continue; // Item Number required
        // Apply skip-by-prefix rules
        const upper = itemNumber.toUpperCase();
        if (prefixes.some((p) => p && upper.startsWith(p))) continue;
        stmtUpsertItem.run(vals);
        upserted++;
      }
    });
    tx(rows);

    // Save JSON snapshot to {base}/data/pricelists/pricelist-YYYY-MM-DD-hhmm.json
    const { baseDir, pricelistsDir } = resolveDataDirs();
    const filename = `pricelist-${tsForFilename()}.json`;
    const outPath = path.join(pricelistsDir, filename);
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");

    // AUDIT LOG for upload (Sydney-local timestamp)
    try {
      stmtLogPriceUpload.run({
        filename: originalname ?? "",
        stored_path: outPath,
        mimetype: mimetype ?? null,
        size_bytes: typeof size === "number" ? size : null,
        parsed_rows: upserted,
        uploaded_at: sydneyNowSql(),
      });
    } catch (logErr) {
      console.warn(
        "[items.upload] audit log failed:",
        (logErr as Error).message
      );
    }

    return res.json({
      ok: true,
      parsedRows: rows.length,
      upserted,
      sawHeaders: Object.keys(rows[0] ?? {}),
      firstLine: firstLine.slice(0, 120),
      snapshot: {
        saved: true,
        relative: path.relative(baseDir, outPath),
        filename,
      },
      encodingHint: buffer.slice(0, 2).toString("hex"),
    });
  } catch (e: any) {
    console.error("Upload parse error:", e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});

router.post("/clear", requireAdmin, (_req, res) => {
  try {
    const info = db.prepare(`DELETE FROM items`).run();
    const deleted = typeof info.changes === "number" ? info.changes : 0;

    // AUDIT LOG for clear (NEGATIVE parsed_rows)
    try {
      stmtLogPriceUpload.run({
        filename: "CLEAR",
        stored_path: "items table truncate",
        mimetype: null,
        size_bytes: null,
        parsed_rows: -deleted,
        uploaded_at: sydneyNowSql(),
      });
    } catch (logErr) {
      console.warn(
        "[items.clear] audit log failed:",
        (logErr as Error).message
      );
    }

    db.exec(`VACUUM`);
    res.json({ ok: true, deleted });
  } catch (e: any) {
    console.error("Clear error:", e);
    res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});

// Read current import rules
router.get("/rules", (_req, res) => {
  try {
    const rules = loadImportRules();
    res.json({ ok: true, rules });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Failed to read rules" });
  }
});

// Save import rules
router.post("/rules", requireAdmin, (req, res) => {
  try {
    const body = (req.body || {}) as ImportRules;
    const arr = Array.isArray(body.itemNumberPrefixes) ? body.itemNumberPrefixes : [];
    const clean = arr.filter((s) => typeof s === "string").map((s) => s.trim()).filter(Boolean);
    saveImportRules({ itemNumberPrefixes: clean });
    res.json({ ok: true, rules: { itemNumberPrefixes: clean } });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message || "Failed to save rules" });
  }
});

router.get("/", (_req, res) => res.json(stmtGetAllItems.all()));
router.get("/compact", (req, res) => {
  try {
    // Load base rows
    const rows = stmtGetCompact.all() as Array<{
      itemNumber: string;
      productName: string;
      description: string;
      price: string; // e.g., "$45.00"
    }>;

    // Helper: parse price string like "$1,234.56" -> cents number
    function toCents(price: string): number | null {
      if (!price) return null;
      const cleaned = String(price).replace(/[^0-9.,-]/g, "").replace(/,/g, "");
      if (!cleaned) return null;
      const n = Number(cleaned);
      if (!Number.isFinite(n)) return null;
      return Math.max(0, Math.round(n * 100));
    }

    // Helper: format cents to $X.XX
    function formatAud(cents: number): string {
      const val = Math.max(0, Math.round(cents)) / 100;
      return `$${val.toFixed(2)}`;
    }

    // Determine if current session belongs to THE TRUSTEE FOR PSS FUND (case-insensitive)
    let discountPct = 0;
    try {
      const sid = (req as any).cookies?.sid;
      // Lazy import to avoid circulars
      const { SESSIONS } = require("./auth");
      const customerId = sid ? SESSIONS.get(sid) : null;
      if (customerId) {
        // Fetch customer + optional linked business to check names
        const row = db
          .prepare(
            `SELECT
               '' AS company_name,
               '' AS trading_name,
               LOWER(COALESCE(b.entity_name, ''))   AS entity_name,
               LOWER(COALESCE(b.business_name, '')) AS business_name
             FROM customers c
             LEFT JOIN business_customer b ON b.id = c.business_id
             WHERE c.id = ?`
          )
          .get(customerId) as
          | {
              company_name?: string;
              trading_name?: string;
              entity_name?: string;
              business_name?: string;
            }
          | undefined;

        const target = "the trustee for pss fund";
        if (row) {
          const fields = [row.entity_name, row.business_name];
          if (fields.some((v) => (v ?? "") === target)) {
            discountPct = 0.15;
          }
        }
      }
    } catch (e) {
      // Non-fatal: fall back to no discount
      console.warn("[items.compact] discount check failed:", (e as Error)?.message);
    }

    // Attach business special pricing if signed-in and linked to a business
    let bizOverrides: Map<string, number> | null = null; // itemNumber -> price_cents
    try {
      const sid = (req as any).cookies?.sid;
      const { SESSIONS } = require("./auth");
      const customerId = sid ? SESSIONS.get(sid) : null;
      if (customerId) {
        const b = db
          .prepare(`SELECT business_id FROM customers WHERE id = ?`)
          .get(customerId) as { business_id?: number } | undefined;
        if (b?.business_id) {
          const list = db
            .prepare(`SELECT item_number AS itemNumber, price_cents AS priceCents FROM business_pricing WHERE business_id = ?`)
            .all(b.business_id) as Array<{ itemNumber: string; priceCents: number }>;
          bizOverrides = new Map(list.map((r) => [r.itemNumber, r.priceCents]));
        }
      }
    } catch (e) {
      // non-fatal
      console.warn("[items.compact] special pricing lookup failed:", (e as Error)?.message);
    }

    if (!discountPct && !bizOverrides) return res.json(rows);

    // Apply discount to price column for display only
    const discounted = rows.map((r) => {
      const cents = toCents(r.price);
      if (cents == null) return r; // leave as-is if unparsable
      const out: any = { ...r };
      if (discountPct) {
        const newCents = Math.max(0, Math.round(cents * (1 - discountPct)));
        out.price = formatAud(newCents);
      }
      if (bizOverrides && bizOverrides.has(r.itemNumber)) {
        const sp = bizOverrides.get(r.itemNumber)!;
        out.specialPrice = formatAud(sp);
      }
      return out;
    });
    return res.json(discounted);
  } catch (e: any) {
    console.error("[items.compact] error:", e);
    return res.status(500).json({ ok: false, message: e?.message || "Failed to load items" });
  }
});

router.get("/_count", (_req, res) => {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM items`).get() as {
    n: number;
  };
  res.json({ ok: true, count: row.n });
});
router.get("/_sample", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM items LIMIT 3`).all();
  res.json({ ok: true, sample: rows });
});

// Update a subset of fields for a single item identified by Item Number
router.post("/update", requireAdmin, (req, res) => {
  try {
    const { itemNumber, productName, description, price } = (req.body || {}) as {
      itemNumber?: string;
      productName?: string;
      description?: string;
      price?: string | number;
    };
    const key = String(itemNumber ?? "").trim();
    if (!key) return res.status(400).json({ ok: false, message: "itemNumber is required" });

    // Allow partial updates using COALESCE to keep existing values when null/undefined
    const info = db
      .prepare(
        `UPDATE items SET
           "Item Name"     = COALESCE(?, "Item Name"),
           "Description"   = COALESCE(?, "Description"),
           "Selling Price" = COALESCE(?, "Selling Price")
         WHERE "Item Number" = ?`
      )
      .run(
        productName !== undefined && productName !== null ? String(productName) : null,
        description !== undefined && description !== null ? String(description) : null,
        price !== undefined && price !== null ? String(price) : null,
        key
      );

    if (info.changes === 0) {
      return res.status(404).json({ ok: false, message: "Item not found" });
    }

    // Return the updated compact row
    const row = db
      .prepare(
        `SELECT
           "Item Number"   AS itemNumber,
           "Item Name"     AS productName,
           "Description"   AS description,
           "Selling Price" AS price
         FROM items WHERE "Item Number" = ?`
      )
      .get(key);
    return res.json({ ok: true, item: row });
  } catch (e: any) {
    console.error("[items.update] error:", e);
    return res.status(500).json({ ok: false, message: e?.message || "Update failed" });
  }
});

export default router;
