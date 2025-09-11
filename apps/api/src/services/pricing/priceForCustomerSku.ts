import { getCustomerDiscount } from "./getCustomerDiscount";
import { getRuleForSku } from "./getCustomerRules";
import { applyDiscount } from "./applyDiscount";

export function priceForCustomerSku(params: {
  customerId?: string;
  sku: string;
  basePriceCents: number;
}): { customerPriceCents: number; applied: { type: "fixed" | "rule" | "default" | "none"; value: number } } {
  const customerId = (params.customerId || "").trim();
  const rule = customerId ? getRuleForSku(customerId, params.sku) : null;

  if (rule?.fixedPriceCents != null) {
    const fixed = Math.max(0, Math.round(rule.fixedPriceCents));
    return { customerPriceCents: fixed, applied: { type: "fixed", value: fixed } };
  }

  if (rule?.discountPct != null) {
    const pct = Math.min(Math.max(rule.discountPct, 0), 0.9);
    return { customerPriceCents: applyDiscount(params.basePriceCents, pct), applied: { type: "rule", value: pct } };
  }

  const defaultPct = getCustomerDiscount(customerId);
  if (defaultPct > 0) {
    return { customerPriceCents: applyDiscount(params.basePriceCents, defaultPct), applied: { type: "default", value: defaultPct } };
  }

  return { customerPriceCents: params.basePriceCents, applied: { type: "none", value: 0 } };
}
