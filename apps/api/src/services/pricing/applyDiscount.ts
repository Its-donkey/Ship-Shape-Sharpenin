export function applyDiscount(baseCents: number, discountPct: number): number {
  const pct = Math.min(Math.max(discountPct, 0), 0.9);
  const discounted = Math.round(baseCents * (1 - pct));
  return Math.max(discounted, 0);
}
