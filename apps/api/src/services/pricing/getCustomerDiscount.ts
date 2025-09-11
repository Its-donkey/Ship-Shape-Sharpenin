import * as fs from "fs";
import * as path from "path";

type DiscountMap = Record<string, number>;
let cache: { map: DiscountMap; mtimeMs: number } | null = null;

export function getCustomerDiscount(customerId?: string): number {
  const file = path.join(__dirname, "..", "data", "customer-discounts.json");
  if (!fs.existsSync(file)) return 0;

  const stat = fs.statSync(file);
  if (!cache || cache.mtimeMs !== stat.mtimeMs) {
    cache = {
      map: JSON.parse(fs.readFileSync(file, "utf8")) as DiscountMap,
      mtimeMs: stat.mtimeMs,
    };
  }

  const id = (customerId || "").trim();
  const pct = cache.map[id] ?? cache.map["DEFAULT"] ?? 0;
  return Math.min(Math.max(pct, 0), 0.9);
}
