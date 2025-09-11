import * as fs from "fs";
import * as path from "path";

export type CustomerRule = { sku: string; discountPct?: number; fixedPriceCents?: number };
export type CustomerRulesFile = { customerName?: string; rules: CustomerRule[] };

const cache: Record<string, { mtimeMs: number; data: CustomerRulesFile | null }> = {};

function loadRulesFile(customerId: string): CustomerRulesFile | null {
  const file = path.join(__dirname, "..", "data", "customer-overrides", `${customerId}.json`);
  if (!fs.existsSync(file)) return null;

  const stat = fs.statSync(file);
  const cached = cache[customerId];
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;

  const data = JSON.parse(fs.readFileSync(file, "utf8")) as CustomerRulesFile;
  cache[customerId] = { mtimeMs: stat.mtimeMs, data };
  return data;
}

export function getRuleForSku(customerId: string, sku: string): CustomerRule | null {
  const file = loadRulesFile(customerId);
  if (!file) return null;
  const key = sku.trim().toUpperCase();
  return file.rules.find((r) => r.sku.trim().toUpperCase() === key) ?? null;
}
