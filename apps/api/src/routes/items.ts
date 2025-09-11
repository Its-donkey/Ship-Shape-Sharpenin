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
} from "../db/client";
import { TextDecoder } from "util";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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
router.post("/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ ok: false, error: "No file uploaded" });

    const { originalname, size, buffer, mimetype } = req.file;
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

    // Upsert into DB (valuesFromRowFlexible handles aliasing to ITEM_COLS)
    let upserted = 0;
    const tx = db.transaction((all: Array<Record<string, string>>) => {
      for (const obj of all) {
        const vals = valuesFromRowFlexible(obj);
        if (!vals[0]) continue; // Item Number required
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

router.post("/clear", (_req, res) => {
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

router.get("/", (_req, res) => res.json(stmtGetAllItems.all()));
router.get("/compact", (_req, res) => res.json(stmtGetCompact.all()));

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

export default router;
