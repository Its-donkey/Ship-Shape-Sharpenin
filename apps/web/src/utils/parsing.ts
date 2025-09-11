// src/utils/parsing.ts

/** Trim + strip BOM */
export function clean(s: string | undefined) {
  return (s ?? "").trim().replace(/^\uFEFF/, "");
}

/** Parse TSV string into objects keyed by header row
 *  - Skips first line if it equals "{}"
 *  - Expects TAB-delimited rows
 */
export function parseItemsTxt(txt: string) {
  const norm = txt.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = norm.split("\n");

  const headerLineIndex = lines[0]?.trim() === "{}" ? 1 : 0;
  const headerLine = lines[headerLineIndex] ?? "";

  if (!headerLine.includes("\t")) {
    throw new Error("Expected a TAB-separated file (TSV). The header row has no tabs.");
  }

  const headers = headerLine.split("\t").map(clean);
  const items: Record<string, string>[] = [];

  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const cols = line.split("\t").map(clean);
    const obj: Record<string, string> = {};
    for (let idx = 0; idx < headers.length; idx++) {
      const h = headers[idx];
      if (!h) continue;
      obj[h] = cols[idx] ?? "";
    }
    items.push(obj);
  }

  return items;
}

/** Extracts the last numeric value from a messy cell (e.g. "X 1 Y $12.34") */
export function sanitizePrice(cell: string) {
  const s = String(cell || "");
  const matches = s.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/g);
  if (!matches) return "";
  const last = matches[matches.length - 1];
  return last.replace(/,/g, "");
}
