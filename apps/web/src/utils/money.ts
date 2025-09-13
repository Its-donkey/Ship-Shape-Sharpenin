//apps/web/src/utils/money.ts

// src/utils/money.ts

/** Add +10% only for display and format in AUD */
export function formatMoneyPlus10(raw: string) {
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  if (Number.isFinite(n)) {
    const adjusted = n * 1.1;
    return adjusted.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
  }
  return raw || "";
}
