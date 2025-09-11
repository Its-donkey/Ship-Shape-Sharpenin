import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type AppliedInfo = { type: "fixed" | "rule" | "default" | "none"; value: number };
type PriceRow = { sku: string; name: string; listPriceCents: number; customerPriceCents: number; applied: AppliedInfo };
type ApiResponse = { customerId: string; count: number; prices: PriceRow[] };

function formatAUD(cents: number) { return ((cents ?? 0) / 100).toLocaleString("en-AU", { style: "currency", currency: "AUD" }); }
function pctLabel(p: number) { return `${(p * 100).toFixed(p >= 0.1 ? 0 : 2)}%`; }

export default function MGISPricingPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyDiscounted, setOnlyDiscounted] = useState(true);
  const [sortKey, setSortKey] = useState<"sku" | "name" | "list" | "customer" | "savings">("savings");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/prices?customerId=MGIS");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (alive) setData(json);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Failed to load");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const src = data?.prices ?? [];
    const filtered = src.filter(r => {
      const matches = !q || r.sku.toLowerCase().includes(q.toLowerCase()) || (r.name || "").toLowerCase().includes(q.toLowerCase());
      const hasDiscount = r.applied.type === "fixed" || r.applied.type === "rule" || r.applied.type === "default";
      return matches && (!onlyDiscounted || hasDiscount);
    });
    const withSavings = filtered.map(r => ({
      ...r,
      savingsCents: r.listPriceCents - r.customerPriceCents,
      savingsPct: r.listPriceCents > 0 ? (r.listPriceCents - r.customerPriceCents) / r.listPriceCents : 0,
    }));
    const mul = (sortDir === "asc" ? 1 : -1);
    return [...withSavings].sort((a,b) => {
      switch (sortKey) {
        case "sku": return mul * a.sku.localeCompare(b.sku);
        case "name": return mul * (a.name || "").localeCompare(b.name || "");
        case "list": return mul * (a.listPriceCents - b.listPriceCents);
        case "customer": return mul * (a.customerPriceCents - b.customerPriceCents);
        default: return mul * (a.savingsCents - b.savingsCents);
      }
    });
  }, [data, q, onlyDiscounted, sortKey, sortDir]);

  const headerButton = (key: typeof sortKey, label: string) => {
    const active = sortKey === key;
    return (
      <button
        onClick={() => active ? setSortDir(d => d === "asc" ? "desc" : "asc") : (setSortKey(key), setSortDir(key === "sku" || key === "name" ? "asc" : "desc"))}
        className={"text-left w-full hover:underline " + (active ? "font-semibold" : "font-normal")}
        title={`Sort by ${label}`}
      >
        {label}<span className="inline-block ml-1 text-xs opacity-70">{active ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">MGIS Pricing</h1>
          <p className="text-sm text-gray-600">Showing pricing from <code>price-list.json</code> plus rules in <code>server/data/customer-overrides/MGIS.json</code>.</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU or name…" className="rounded-full border px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring focus:ring-accent/30" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyDiscounted} onChange={(e) => setOnlyDiscounted(e.target.checked)} className="h-4 w-4" />
            Only discounted
          </label>
        </div>
      </div>

      {loading && <div className="rounded-xl border p-6 text-center shadow-sm"><div className="animate-pulse text-sm text-gray-600">Loading MGIS prices…</div></div>}
      {err && <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">Failed to load: {err} — Is the API running and is <code>/api/prices?customerId=MGIS</code> available?</div>}

      {!loading && !err && (
        <>
          <div className="mb-3 text-sm text-gray-600">{rows.length} items{onlyDiscounted ? " (discounted)" : ""} • Customer: <span className="font-semibold">MGIS</span></div>
          <div className="overflow-x-auto rounded-2xl border shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-gray-700">
                  <th className="p-3 w-[9rem]">{headerButton("sku","SKU")}</th>
                  <th className="p-3">{headerButton("name","Name")}</th>
                  <th className="p-3 text-right">{headerButton("list","List")}</th>
                  <th className="p-3 text-right">{headerButton("customer","MGIS")}</th>
                  <th className="p-3 text-right">{headerButton("savings","Savings")}</th>
                  <th className="p-3 text-right">Applied</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isDiscount = r.applied.type !== "none";
                  const badge =
                    r.applied.type === "fixed" ? { label: "Fixed", cls: "bg-indigo-100 text-indigo-700" } :
                    r.applied.type === "rule" ? { label: `Rule ${pctLabel(r.applied.value)}`, cls: "bg-green-100 text-green-700" } :
                    r.applied.type === "default" ? { label: `Default ${pctLabel(r.applied.value)}`, cls: "bg-amber-100 text-amber-700" } :
                    { label: "—", cls: "bg-gray-100 text-gray-500" };
                  return (
                    <tr key={r.sku} className={"border-t " + (isDiscount ? "bg-white hover:bg-green-50/40" : "bg-white hover:bg-gray-50")}>
                      <td className="p-3 font-mono text-xs font-semibold">{r.sku}</td>
                      <td className="p-3">{r.name}</td>
                      <td className="p-3 text-right">{formatAUD(r.listPriceCents)}</td>
                      <td className={"p-3 text-right " + (isDiscount ? "font-semibold" : "")}>{formatAUD(r.customerPriceCents)}</td>
                      <td className="p-3 text-right">
                        {r.listPriceCents > 0 ? (
                          <>
                            <div>{formatAUD(r.listPriceCents - r.customerPriceCents)}</div>
                            <div className="text-[11px] text-gray-500">{(((r.listPriceCents - r.customerPriceCents) / r.listPriceCents) * 100).toFixed(1)}%</div>
                          </>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`inline-block rounded-full px-2 py-1 text-[11px] ${badge.cls}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">No items match your filters.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            Source files: <code>server/data/price-list.json</code>, <code>server/data/customer-overrides/MGIS.json</code>, <code>server/data/customer-discounts.json</code>. API: <code>GET /api/prices?customerId=MGIS</code>.
          </div>

          <div className="mt-3">
            <Link to="/" className="inline-block rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition hover:scale-105 hover:shadow">Back to Home</Link>
          </div>
        </>
      )}
    </div>
  );
}
