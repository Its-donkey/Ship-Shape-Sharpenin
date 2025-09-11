// server/db.ts
import Database, { type Statement } from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * SQLite with deterministic migrations + flexible ITEMS.txt ingestion.
 * - DB lives in server/data/app.db (dev & prod). You can override with APP_DATA_DIR.
 * - PRAGMA user_version governs which migrations to run.
 *   - V1: items
 *   - V2: customers (incl. extended profile fields)
 *   - V3: ensure price_uploads (audit table even if bootstrapped to v2)
 */

// ---------- Resolve data dir (works in ts-node and dist builds) -------------
const resolvedDataDir = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(
      path.resolve(
        __dirname,
        __dirname.includes(`${path.sep}dist${path.sep}`) ? "../.." : ".."
      ),
      "server",
      "data"
    );

if (!fs.existsSync(resolvedDataDir)) fs.mkdirSync(resolvedDataDir, { recursive: true });

const dbPath = path.join(resolvedDataDir, "app.db");

// ---------- Open DB ----------------------------------------------------------
export const db = new Database(dbPath, { fileMustExist: false, timeout: 5000 });

// Pragmas
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
db.pragma("temp_store = MEMORY");
db.pragma("cache_size = -16000"); // ~16 MB
db.pragma("busy_timeout = 5000");

// ---------- Migration helpers ------------------------------------------------
function getUserVersion(): number {
  const row = db.prepare("PRAGMA user_version;").get() as { user_version: number };
  return row?.user_version ?? 0;
}
function setUserVersion(v: number) {
  db.pragma(`user_version = ${v}`);
}
function runMigration(version: number, fn: () => void) {
  const tx = db.transaction(fn);
  tx();
  setUserVersion(version);
  // eslint-disable-next-line no-console
  console.log(`[db] migrated to v${version}`);
}
function tableExists(name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(name) as { name: string } | undefined;
  return !!row;
}
function columnExists(table: string, col: string): boolean {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return rows.some((r) => r.name === col);
  } catch {
    return false;
  }
}
function ensureColumn(table: string, col: string, type: string): void {
  if (!columnExists(table, col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`);
  }
}

/**
 * If user_version is 0 but tables already exist (e.g., created manually in the past),
 * infer a sensible baseline so migrations apply cleanly.
 * - If customers exists → baseline v2
 * - Else if items exists → baseline v1
 * (price_uploads is ensured by v3)
 */
function bootstrapUserVersionIfNeeded() {
  const v = getUserVersion();
  if (v > 0) return;

  const hasCustomers = tableExists("customers");
  const hasItems = tableExists("items");

  if (hasCustomers) {
    setUserVersion(2);
    console.log("[db] bootstrapped user_version=2 from existing schema");
    return;
  }
  if (hasItems) {
    setUserVersion(1);
    console.log("[db] bootstrapped user_version=1 from existing schema");
  }
}

// ---------- Migrations -------------------------------------------------------
// V1 (baseline): items (MYOB-friendly wide schema)
function migrateToV1() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,

      "Item Number"           TEXT NOT NULL,
      "Item Name"             TEXT,
      "Buy"                   TEXT,
      "Sell"                  TEXT,
      "Inventory"             TEXT,
      "Asset Acct"            TEXT,
      "Income Acct"           TEXT,
      "Expense/COS Acct"      TEXT,
      "Description"           TEXT,
      "Use Desc. On Invoice"  TEXT,
      "Primary Supplier"      TEXT,
      "Supplier Item Number"  TEXT,
      "Tax Code When Bought"  TEXT,
      "Buy Unit Measure"      TEXT,
      "No. Items/Buy Unit"    TEXT,
      "Reorder Quantity"      TEXT,
      "Minimum Level"         TEXT,
      "Selling Price"         TEXT,
      "Sell Unit Measure"     TEXT,
      "Tax Code When Sold"    TEXT,
      "Sell Price Inclusive"  TEXT,
      "No. Items/Sell Unit"   TEXT,
      "Inactive Item"         TEXT,
      "Standard Cost"         TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE("Item Number") ON CONFLICT REPLACE
    );
    CREATE INDEX IF NOT EXISTS idx_items_item_number ON items("Item Number");
    CREATE INDEX IF NOT EXISTS idx_items_item_name   ON items("Item Name");
  `);
}

// V2 (customers incl. extended profile fields)
function migrateToV2() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      email          TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      name           TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  `);

  ensureColumn("customers", "company_name",  "TEXT");
  ensureColumn("customers", "trading_name",  "TEXT");
  ensureColumn("customers", "abn",           "TEXT");
  ensureColumn("customers", "delivery_addr", "TEXT");
  ensureColumn("customers", "billing_addr",  "TEXT");
  ensureColumn("customers", "phone",         "TEXT");
}

// V3 (ensure price_uploads exists even if we started at v2)
function migrateToV3() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_uploads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      filename      TEXT NOT NULL,
      stored_path   TEXT NOT NULL, -- e.g., server/data/pricelists/pricelist-YYYY-MM-DD-hhmm.json
      mimetype      TEXT,
      size_bytes    INTEGER,
      parsed_rows   INTEGER,
      uploaded_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_price_uploads_time ON price_uploads(uploaded_at);
  `);
}

// Apply pending migrations
(function applyMigrations() {
  bootstrapUserVersionIfNeeded();

  let v = getUserVersion();
  if (v < 1) {
    runMigration(1, migrateToV1);
    v = 1;
  }
  if (v < 2) {
    runMigration(2, migrateToV2);
    v = 2;
  }
  if (v < 3) {
    runMigration(3, migrateToV3);
    v = 3;
  }
})();

// ---------- Item column model & helpers -------------------------------------
export const ITEM_COLS = [
  "Item Number","Item Name","Buy","Sell","Inventory","Asset Acct","Income Acct",
  "Expense/COS Acct","Description","Use Desc. On Invoice","Primary Supplier",
  "Supplier Item Number","Tax Code When Bought","Buy Unit Measure","No. Items/Buy Unit",
  "Reorder Quantity","Minimum Level","Selling Price","Sell Unit Measure","Tax Code When Sold",
  "Sell Price Inclusive","No. Items/Sell Unit","Inactive Item","Standard Cost"
] as const;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[\s._\-\/]+/g, "")
    .replace(/[#:().]/g, "");
}

// Aliases: normalised header → canonical header
const ALIASES = new Map<string, (typeof ITEM_COLS)[number]>([
  ["itemnumber","Item Number"], ["itemno","Item Number"], ["item","Item Number"],
  ["item#","Item Number"], ["code","Item Number"], ["sku","Item Number"],
  ["itemname","Item Name"], ["name","Item Name"], ["productname","Item Name"], ["title","Item Name"],
  ["buy","Buy"], ["sell","Sell"], ["inventory","Inventory"],
  ["assetacct","Asset Acct"], ["incomeacct","Income Acct"], ["expensecosacct","Expense/COS Acct"],
  ["description","Description"], ["usedesconinvoice","Use Desc. On Invoice"],
  ["primarysupplier","Primary Supplier"], ["supplieritemnumber","Supplier Item Number"],
  ["taxcodewhenbought","Tax Code When Bought"], ["buyunitmeasure","Buy Unit Measure"],
  ["noitemsbuyunit","No. Items/Buy Unit"], ["reorderquantity","Reorder Quantity"],
  ["minimumlevel","Minimum Level"], ["sellingprice","Selling Price"],
  ["sellunitmeasure","Sell Unit Measure"], ["taxcodewhensold","Tax Code When Sold"],
  ["sellpriceinclusive","Sell Price Inclusive"], ["noitemssellunit","No. Items/Sell Unit"],
  ["inactiveitem","Inactive Item"], ["standardcost","Standard Cost"],
]);

// Map a parsed row { header: value } into ordered values for INSERT … VALUES(?…)
export function valuesFromRowFlexible(row: Record<string, any>): string[] {
  const canon: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(row)) {
    const n = norm(String(rawKey));
    const canonical = ALIASES.get(n);
    if (canonical) canon[canonical] = String(rawVal ?? "").trim();
  }
  const itemNum =
    canon["Item Number"] ??
    (row as any)["Item Number"] ?? (row as any)["Item No"] ?? (row as any)["Item No."] ?? (row as any)["Item #"] ??
    (row as any)["SKU"] ?? (row as any)["Code"] ?? "";
  canon["Item Number"] = String(itemNum ?? "").trim();

  return ITEM_COLS.map((col) => (canon[col] ?? "").toString());
}

// ---------- Prepared statements (items) --------------------------------------
const placeholders = ITEM_COLS.map(() => "?").join(",");
const quotedCols = ITEM_COLS.map((c) => JSON.stringify(c)).join(", ");
const updateSet = ITEM_COLS
  .filter((c) => c !== "Item Number")
  .map((c) => `${JSON.stringify(c)} = excluded.${JSON.stringify(c)}`)
  .join(", ");
const selectCols = quotedCols;

export const stmtUpsertItem = db.prepare(
  `INSERT INTO items (${quotedCols})
   VALUES (${placeholders})
   ON CONFLICT("Item Number") DO UPDATE SET
   ${updateSet},
   created_at = datetime('now')`
);

export const stmtGetAllItems = db.prepare(
  `SELECT ${selectCols}
   FROM items
   ORDER BY "Item Name" COLLATE NOCASE`
);

export const stmtGetCompact = db.prepare(
  `SELECT
      "Item Name"     AS productName,
      "Description"   AS description,
      "Selling Price" AS price
   FROM items
   ORDER BY productName COLLATE NOCASE`
);

// ---------- Sydney time helper & audit logging ------------------------------
/** Format Australia/Sydney local time as 'YYYY-MM-DD HH:MM:SS' for SQLite TEXT */
export function sydneyNowSql(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export type PriceUploadInsert = {
  filename: string;
  stored_path: string;
  mimetype: string | null;
  size_bytes: number | null;
  parsed_rows: number | null;
  uploaded_at: string; // Sydney local 'YYYY-MM-DD HH:MM:SS'
};

export const stmtLogPriceUpload = db.prepare<PriceUploadInsert>(`
  INSERT INTO price_uploads (filename, stored_path, mimetype, size_bytes, parsed_rows, uploaded_at)
  VALUES (@filename, @stored_path, @mimetype, @size_bytes, @parsed_rows, @uploaded_at)
`);

// ---------- Customer types ---------------------------------------------------
export type InsertCustomerParams = {
  email: string;
  password_hash: string;
  name: string | null;
  company_name: string | null;
  trading_name: string | null;
  abn: string | null;
  delivery_addr: string | null;
  billing_addr: string | null;
  phone: string | null;
};

export type CustomerMinimalRow = {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
};

export type CustomerProfileRow = CustomerMinimalRow & {
  company_name: string | null;
  trading_name: string | null;
  abn: string | null;
  delivery_addr: string | null;
  billing_addr: string | null;
  phone: string | null;
};

// ---------- Prepared statements (customers) ----------------------------------
export const stmts: {
  insertCustomer: Statement<InsertCustomerParams>;
  getCustomerByEmail: Statement<string, any>;
  getCustomerById: Statement<number, CustomerMinimalRow>;
  getCustomerProfileById: Statement<number, CustomerProfileRow>;
} = {
  insertCustomer: db.prepare<InsertCustomerParams>(`
    INSERT INTO customers (
      email,
      password_hash,
      name,
      company_name,
      trading_name,
      abn,
      delivery_addr,
      billing_addr,
      phone
    ) VALUES (
      @email,
      @password_hash,
      @name,
      @company_name,
      @trading_name,
      @abn,
      @delivery_addr,
      @billing_addr,
      @phone
    )
  `),

  getCustomerByEmail: db.prepare<string, any>(`SELECT * FROM customers WHERE email = ?`),

  getCustomerById: db.prepare<number, CustomerMinimalRow>(`
    SELECT id, email, name, created_at
    FROM customers
    WHERE id = ?
  `),

  getCustomerProfileById: db.prepare<number, CustomerProfileRow>(`
    SELECT
      id, email, name, created_at,
      company_name, trading_name, abn,
      delivery_addr, billing_addr, phone
    FROM customers
    WHERE id = ?
  `),
};

export function withTransaction<T>(fn: () => T): T {
  const tx = db.transaction(fn);
  return tx();
}

export default db;
