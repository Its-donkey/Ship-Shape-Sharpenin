//apps/api/src/db/database.ts

// server/db.ts
import Database, { type Statement } from "better-sqlite3";
export type DB = InstanceType<typeof Database>;
import fs from "fs";
import path from "path";

/**
 * SQLite with deterministic migrations + flexible ITEMS.txt ingestion.
 * - DB lives in server/data/app.db (dev & prod). You can override with APP_DATA_DIR.
 * - PRAGMA user_version governs which migrations to run.
 *   - V1: items
 *   - V2: customers (incl. extended profile fields)
 *   - V3: ensure price_uploads (audit table even if bootstrapped to v2)
 *   - V4: top-level domains store
 *   - V5: add active flag to tlds and backfill
 *   - V6: business_customer table + customers.business_id
 *   - V7: remove business_customer.unique_id; use numeric id; customers.business_id -> INTEGER
 *   - V8: (removed) trade pricing table creation
 *   - V9: add customers.is_trade flag
 *   - V10: add customers.is_admin flag
 *   - V11: drop trade pricing tables if present
 *   - V12: drop trade pricing tables for DBs already at v11
 *   - V13: business_pricing table for per-business item overrides
 *   - V14: drop legacy business fields from customers (normalize via business_customer)
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
export const db: DB = new Database(dbPath, { fileMustExist: false, timeout: 5000 });

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

// V4 (TLD store)
function migrateToV4() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tlds (
      tld         TEXT NOT NULL,
      date_added  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tlds_date ON tlds(date_added);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tlds_unique ON tlds(tld, date_added);
  `);
}

// V5 (add active flag to tlds)
function migrateToV5() {
  // Add active column if missing, default 0
  try {
    db.exec(`ALTER TABLE tlds ADD COLUMN active INTEGER NOT NULL DEFAULT 0`);
  } catch (e) {
    // ignore if exists
  }
  // Backfill: mark rows from latest date as active, others inactive
  db.exec(`
    UPDATE tlds
    SET active = CASE WHEN date_added = (SELECT MAX(date_added) FROM tlds) THEN 1 ELSE 0 END
  `);
}

// V6 (business_customer + customers.business_id)
function migrateToV6() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_customer (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      unique_id        TEXT NOT NULL UNIQUE,
      abn              TEXT,
      entity_name      TEXT,
      business_name    TEXT,
      delivery_address TEXT,
      billing_address  TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_business_unique
      ON business_customer(
        abn COLLATE NOCASE,
        entity_name COLLATE NOCASE,
        business_name COLLATE NOCASE
      );
  `);
  // Link from customers → business (store unique_id text)
  try {
    db.exec(`ALTER TABLE customers ADD COLUMN business_id TEXT`);
  } catch {}
}

// V7 (remove unique_id, convert customers.business_id to INTEGER FK)
function migrateToV7() {
  // 1) Add temporary integer column to customers to hold numeric business ids
  try {
    db.exec(`ALTER TABLE customers ADD COLUMN business_id_int INTEGER`);
  } catch {}

  // 2) Populate business_id_int by joining existing TEXT business_id (which stored unique_id)
  try {
    db.exec(`
      UPDATE customers SET business_id_int = (
        SELECT id FROM business_customer b
        WHERE COALESCE(b.unique_id,'') <> '' AND b.unique_id = customers.business_id
      )
    `);
  } catch {}

  // 3) Rebuild business_customer without unique_id
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_customer_new (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      abn              TEXT,
      entity_name      TEXT,
      business_name    TEXT,
      delivery_address TEXT,
      billing_address  TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    INSERT INTO business_customer_new (id, abn, entity_name, business_name, delivery_address, billing_address, created_at)
    SELECT id, abn, entity_name, business_name, delivery_address, billing_address, created_at
    FROM business_customer
  `);
  db.exec(`DROP TABLE business_customer`);
  db.exec(`ALTER TABLE business_customer_new RENAME TO business_customer`);
  // Recreate unique index on normalized identity columns
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_business_unique
      ON business_customer(
        abn COLLATE NOCASE,
        entity_name COLLATE NOCASE,
        business_name COLLATE NOCASE
      )
  `);

  // 4) Rebuild customers table to drop old TEXT business_id and replace with INTEGER
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers_new (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      email          TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      name           TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      company_name   TEXT,
      trading_name   TEXT,
      abn            TEXT,
      delivery_addr  TEXT,
      billing_addr   TEXT,
      phone          TEXT,
      business_id    INTEGER
    );
  `);
  db.exec(`
    INSERT INTO customers_new (
      id, email, password_hash, name, created_at,
      company_name, trading_name, abn, delivery_addr, billing_addr, phone, business_id
    )
    SELECT
      id, email, password_hash, name, created_at,
      company_name, trading_name, abn, delivery_addr, billing_addr, phone,
      business_id_int
    FROM customers
  `);
  db.exec(`DROP TABLE customers`);
  db.exec(`ALTER TABLE customers_new RENAME TO customers`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`);
}

// V8 removed: trade pricing eliminated
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
  if (v < 4) {
    runMigration(4, migrateToV4);
    v = 4;
  }
  if (v < 5) {
    runMigration(5, migrateToV5);
    v = 5;
  }
  if (v < 6) {
    runMigration(6, migrateToV6);
    v = 6;
  }
  if (v < 7) {
    runMigration(7, migrateToV7);
    v = 7;
  }
  // v8 removed
  // V9: ensure is_trade exists (legacy) — kept for historical migrations
  if (v < 9) {
    try { ensureColumn("customers", "is_trade", "INTEGER NOT NULL DEFAULT 0"); } catch {}
    setUserVersion(9);
    v = 9;
    console.log(`[db] migrated to v9`);
  }
  // V10: ensure is_admin exists
  if (v < 10) {
    try {
      ensureColumn("customers", "is_admin", "INTEGER NOT NULL DEFAULT 0");
    } catch {}
    setUserVersion(10);
    v = 10;
    // eslint-disable-next-line no-console
    console.log(`[db] migrated to v10`);
  }
  // V11: drop trade pricing tables if present
  if (v < 11) {
    runMigration(11, () => {
      try { db.exec(`DROP TABLE IF EXISTS trade_pricing;`); } catch {}
      try { db.exec(`DROP TABLE IF EXISTS trade_pricng;`); } catch {}
    });
    v = 11;
  }
  // V12: drop is_trade column from customers by table rebuild
  if (v < 12) {
    runMigration(12, () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS customers_new (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          email          TEXT NOT NULL UNIQUE,
          password_hash  TEXT NOT NULL,
          name           TEXT,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          company_name   TEXT,
          trading_name   TEXT,
          abn            TEXT,
          delivery_addr  TEXT,
          billing_addr   TEXT,
          phone          TEXT,
          business_id    INTEGER,
          is_admin       INTEGER NOT NULL DEFAULT 0
        );
      `);
      db.exec(`
        INSERT INTO customers_new (
          id, email, password_hash, name, created_at,
          company_name, trading_name, abn, delivery_addr, billing_addr, phone, business_id, is_admin
        )
        SELECT
          id, email, password_hash, name, created_at,
          company_name, trading_name, abn, delivery_addr, billing_addr, phone, business_id, COALESCE(is_admin, 0)
        FROM customers;
      `);
      db.exec(`DROP TABLE customers;`);
      db.exec(`ALTER TABLE customers_new RENAME TO customers;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);`);
    });
    v = 12;
    console.log(`[db] migrated to v12 (removed is_trade)`);
  }
  // V12: ensure drop on DBs that were already at v11 from older code
  if (v < 12) {
    runMigration(12, () => {
      try { db.exec(`DROP TABLE IF EXISTS trade_pricing;`); } catch {}
      try { db.exec(`DROP TABLE IF EXISTS trade_pricng;`); } catch {}
    });
    v = 12;
    // eslint-disable-next-line no-console
    console.log(`[db] migrated to v12 (trade tables removed)`);
  }
  // V13: business_pricing table
  if (v < 13) {
    runMigration(13, () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS business_pricing (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          business_id  INTEGER NOT NULL,
          item_number  TEXT    NOT NULL,
          price_cents  INTEGER NOT NULL,
          created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
          UNIQUE(business_id, item_number) ON CONFLICT REPLACE
        );
        CREATE INDEX IF NOT EXISTS idx_biz_price_biz ON business_pricing(business_id);
        CREATE INDEX IF NOT EXISTS idx_biz_price_item ON business_pricing(item_number);
      `);
    });
    v = 13;
    // eslint-disable-next-line no-console
    console.log(`[db] migrated to v13 (business_pricing)`);
  }
  // V14: rebuild customers table without legacy business fields
  if (v < 14) {
    runMigration(14, () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS customers_new (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          email          TEXT NOT NULL UNIQUE,
          password_hash  TEXT NOT NULL,
          name           TEXT,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          phone          TEXT,
          business_id    INTEGER,
          is_admin       INTEGER NOT NULL DEFAULT 0
        );
      `);
      db.exec(`
        INSERT INTO customers_new (
          id, email, password_hash, name, created_at, phone, business_id, is_admin
        )
        SELECT id, email, password_hash, name, created_at, phone, business_id, COALESCE(is_admin,0)
        FROM customers;
      `);
      db.exec(`DROP TABLE customers;`);
      db.exec(`ALTER TABLE customers_new RENAME TO customers;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);`);
    });
    v = 14;
    // eslint-disable-next-line no-console
    console.log(`[db] migrated to v14 (customers normalized)`);
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

export const stmtUpsertItem: Statement = db.prepare(
  `INSERT INTO items (${quotedCols})
   VALUES (${placeholders})
   ON CONFLICT("Item Number") DO UPDATE SET
   ${updateSet},
   created_at = datetime('now')`
);

export const stmtGetAllItems: Statement = db.prepare(
  `SELECT ${selectCols}
   FROM items
   ORDER BY "Item Name" COLLATE NOCASE`
);

export const stmtGetCompact: Statement = db.prepare(
  `SELECT
      "Item Number"   AS itemNumber,
      "Item Name"     AS productName,
      "Description"   AS description,
      "Selling Price" AS price
   FROM items
   ORDER BY productName COLLATE NOCASE`
);

// Trade compact removed

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

export const stmtLogPriceUpload: Statement<PriceUploadInsert> = db.prepare<PriceUploadInsert>(`
  INSERT INTO price_uploads (filename, stored_path, mimetype, size_bytes, parsed_rows, uploaded_at)
  VALUES (@filename, @stored_path, @mimetype, @size_bytes, @parsed_rows, @uploaded_at)
`);

// ---------- Customer types ---------------------------------------------------
export type InsertCustomerParams = {
  email: string;
  password_hash: string;
  name: string | null;
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
  is_admin?: number;
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
      phone
    ) VALUES (
      @email,
      @password_hash,
      @name,
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
      c.id,
      c.email,
      c.name,
      c.created_at,
      b.entity_name      AS company_name,
      b.business_name    AS trading_name,
      b.abn              AS abn,
      b.delivery_address AS delivery_addr,
      b.billing_address  AS billing_addr,
      c.phone,
      c.is_admin
    FROM customers c
    LEFT JOIN business_customer b ON b.id = c.business_id
    WHERE c.id = ?
  `),
};

export function withTransaction<T>(fn: () => T): T {
  const tx = db.transaction(fn);
  return tx();
}

export default db;
