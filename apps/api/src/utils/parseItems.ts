//apps/api/src/utils/parseItems.ts

// file name — /server/utils/parseItems.ts
export type RawItem = Record<string, string>;
export type NormalisedItem = {
  sku?: string;
  productName?: string;
  description?: string;
  price?: number;
};

function normaliseNewlines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
function clean(s: string | undefined) {
  return (s ?? "").trim().replace(/^\uFEFF/, ""); // strip BOM
}
function detectDelimiter(sampleLine: string): "\t" | "," {
  return sampleLine.includes("\t") ? "\t" : ",";
}
function split(line: string, delim: string) {
  return line.split(delim).map(clean);
}
function makeUniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const key = clean(h);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? key : `${key}_${count}`;
  });
}
function toNumberMaybe(s?: string): number | undefined {
  if (!s) return undefined;
  // remove currency, spaces, thousands commas; keep minus & decimal point
  const cleaned = String(s).replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
function firstMatchingKey(obj: RawItem, names: string[]): string | undefined {
  const keys = Object.keys(obj);
  for (const name of names) {
    const needle = name.toLowerCase();
    const k = keys.find((kk) => {
      const low = kk.toLowerCase();
      return low === needle || low.includes(needle);
    });
    if (k) return k;
  }
  return undefined;
}

/**
 * Ignore the first non-empty line.
 * Use the second non-empty line as headers.
 * Return both raw rows (keyed by exact headers) and a normalised view.
 */
export function parseItemsTextRawAndNormalised(data: string): {
  raw: RawItem[];
  normalised: NormalisedItem[];
} {
  const nonEmpty = normaliseNewlines(data)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (nonEmpty.length < 2) return { raw: [], normalised: [] };

  // Ignore first line (title/preamble)
  const lines = nonEmpty.slice(1);
  if (lines.length === 0) return { raw: [], normalised: [] };

  const delim = detectDelimiter(lines[0]);
  const headers = makeUniqueHeaders(split(lines[0], delim));

  const raw: RawItem[] = [];
  const normalised: NormalisedItem[] = [];

  for (const line of lines.slice(1)) {
    const cols = split(line, delim);
    const row: RawItem = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = cols[i] ?? "";
    }
    raw.push(row);

    // Build normalised record
    const skuKey = firstMatchingKey(row, ["item number", "item no", "sku", "code", "item"]);
    const nameKey = firstMatchingKey(row, ["item name", "product name", "name"]);
    const descKey = firstMatchingKey(row, ["description", "long description", "desc"]);
    const priceKey = firstMatchingKey(row, ["selling price", "price", "sell", "retail", "amount"]);

    const norm: NormalisedItem = {};
    if (skuKey) norm.sku = row[skuKey];
    if (nameKey) norm.productName = row[nameKey];
    if (descKey) norm.description = row[descKey];
    if (priceKey) {
      const n = toNumberMaybe(row[priceKey]);
      if (n !== undefined) norm.price = n;
    }
    normalised.push(norm);
  }

  return { raw, normalised };
}
