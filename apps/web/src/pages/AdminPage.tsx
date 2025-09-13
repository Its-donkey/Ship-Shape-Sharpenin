//apps/web/src/pages/AdminPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import AdminExportButton from "../components/ZipExportButton"; // adjust path if needed
import { useAuth } from "../auth/AuthContext";

type UploadResponse = {
  ok: boolean;
  originalname?: string;
  mimetype?: string;
  size?: number;
  parsedRows?: number;
  upserted?: number;
  sawHeaders?: string[];
  firstLine?: string;
  encodingHint?: string;
  error?: string;
};

type CompactRow = { itemNumber: string; productName: string; description: string; price: string };

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CompactRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, { productName: string; description: string; price: string }>>({});
  const { customer, setCustomer } = useAuth();
  // TLD summary state
  const [tldLastDate, setTldLastDate] = useState<string | null>(null);
  const [tldCount, setTldCount] = useState<number | null>(null);
  const [tldBusy, setTldBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "customers" | "businesses" | "backend">("items");
  // Import rules for items upload
  const [rulesBusy, setRulesBusy] = useState(false);
  const [skipPrefixesText, setSkipPrefixesText] = useState<string>("");
  // Customers tab state
  const [customers, setCustomers] = useState<Array<{ id: number; email: string; name: string | null; created_at: string; company_name: string | null; trading_name: string | null; abn: string | null; phone: string | null; is_admin?: number | null; business_id?: number | null }>>([]);
  const [custBusy, setCustBusy] = useState(false);
  // Businesses tab state
  const [businesses, setBusinesses] = useState<Array<{
    id: number;
    abn: string | null;
    entity_name: string | null;
    business_name: string | null;
    delivery_address: string | null;
    billing_address: string | null;
    created_at: string;
    n_customers: number;
  }>>([]);
  const [bizBusy, setBizBusy] = useState(false);
  const [bizPricingOpen, setBizPricingOpen] = useState<number | null>(null);
  const [bizPricing, setBizPricing] = useState<Array<{ itemNumber: string; priceCents: number }>>([]);
  const [newSku, setNewSku] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [bizEditOpen, setBizEditOpen] = useState<null | { id: number; abn: string; entity_name: string; business_name: string; delivery_address: string; billing_address: string }>(null);

  async function openBizPricing(bid: number) {
    setBizPricingOpen(bid);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${bid}/pricing`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || `Load failed (${res.status})`);
      setBizPricing(data.overrides || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load special pricing");
    }
  }

  // Dev-only: toggle to bypass passwords using API /auth/devlogin
  const [skipPasswords, setSkipPasswords] = useState<boolean>(() => {
    try {
      return localStorage.getItem("devSkipPasswords") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (skipPasswords) localStorage.setItem("devSkipPasswords", "1");
      else localStorage.removeItem("devSkipPasswords");
    } catch {}
  }, [skipPasswords]);

  const authStatus = useMemo(() => {
    if (customer) return `Signed in as ${customer.email}`;
    return "Not signed in";
  }, [customer]);

  const onChooseFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setFile(e.target.files?.[0] ?? null);
    setMessage(null);
    setError(null);
  };

  async function refreshCompact(showMsg: boolean = true) {
    setBusy(true);
    setError(null);
    try {
      const [compactRes, countRes] = await Promise.all([
        fetch("/api/items/compact"),
        fetch("/api/items/_count"),
      ]);

      if (!compactRes.ok) throw new Error(`Compact fetch failed (HTTP ${compactRes.status})`);
      if (!countRes.ok) throw new Error(`Count fetch failed (HTTP ${countRes.status})`);

      const compact = (await compactRes.json()) as CompactRow[];
      const countJson = (await countRes.json()) as { ok: boolean; count: number };
      setPreview(compact);
      setCount(countJson.count ?? null);
      if (showMsg) setMessage(`Loaded ${compact.length} items from server.`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load preview.");
    } finally {
      setBusy(false);
    }
  }

  async function loadTldSummary() {
    try {
      const res = await fetch("/api/tlds/summary");
      if (!res.ok) throw new Error(`TLD summary failed (${res.status})`);
      const data = (await res.json()) as { ok: boolean; lastDate: string | null; count: number };
      if (!data.ok) throw new Error("TLD summary not ok");
      setTldLastDate(data.lastDate);
      setTldCount(data.count);
    } catch (e: any) {
      setError(e?.message || "Failed to load TLD summary");
    }
  }


  useEffect(() => {
    // Lazy load all admin data after initial render, without blocking UI
    // Items compact + count
    refreshCompact(false);
    // TLD summary
    loadTldSummary();
    // Customers list (admin-protected; ignore failure for non-admins)
    void (async () => {
      try {
        const res = await fetch("/api/customers/admin/list");
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) setCustomers(data.customers || []);
      } catch {
        // ignore
      }
    })();
    // Businesses list (admin-protected; ignore failure for non-admins)
    void (async () => {
      try {
        const res = await fetch("/api/businesses/admin/list");
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) setBusinesses(data.businesses || []);
      } catch {
        // ignore
      }
    })();
    // Import rules
    void (async () => {
      try {
        const res = await fetch("/api/items/rules");
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          const arr = Array.isArray(data.rules?.itemNumberPrefixes) ? data.rules.itemNumberPrefixes : [];
          setSkipPrefixesText(arr.join(", "));
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  async function tldClear() {
    if (!window.confirm("Clear all stored TLDs?")) return;
    setTldBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tlds/clear", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || `Clear failed (${res.status})`);
      setMessage("Cleared TLDs.");
      await loadTldSummary();
    } catch (e: any) {
      setError(e?.message || "Failed to clear TLDs");
    } finally {
      setTldBusy(false);
    }
  }

  async function tldUpdate() {
    setTldBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tlds/update", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.message || `Update failed (${res.status})`);
      setMessage("Updated TLDs.");
      await loadTldSummary();
    } catch (e: any) {
      setError(e?.message || "Failed to update TLDs");
    } finally {
      setTldBusy(false);
    }
  }

  async function uploadItems() {
    if (!file) {
      setError("Please choose an ITEMS file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/items/upload", { method: "POST", body: form });
      const data: UploadResponse = await res.json();

      if (!res.ok || !data.ok) {
        const detail = data?.firstLine ? ` (firstLine: ${data.firstLine})` : "";
        throw new Error((data.error || `Upload failed (HTTP ${res.status})`) + detail);
      }

      setMessage(
        `Uploaded ${data.originalname} — parsed ${data.parsedRows} rows, upserted ${data.upserted}.`
      );

      // Immediately refresh view
      await refreshCompact();
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clearDatabase() {
    const confirmed = window.confirm(
      "This will permanently delete ALL items from the database. Continue?"
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/items/clear", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; deleted?: number; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Clear failed (HTTP ${res.status})`);
      }
      setPreview([]);
      setCount(0);
      setMessage(`Database cleared. Deleted ${data.deleted ?? 0} rows.`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to clear database.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDevAuth(next: boolean) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (next) {
        // Create a dev session (defaults to customer id 1)
        const res = await fetch("/api/auth/devlogin", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`Dev login failed (HTTP ${res.status})`);
        // Load profile into auth context
        const me = await fetch("/api/customers/me", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (me.ok) {
          const data = (await me.json()) as any;
          const c = data?.customer ?? data;
          setCustomer(c ?? null);
          setMessage("Dev auth enabled — session created.");
        } else {
          setMessage("Dev auth enabled, but failed to load profile.");
        }
      } else {
        // Clear any session
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        setCustomer(null);
        setMessage("Dev auth disabled — signed out.");
      }
      setSkipPasswords(next);
    } catch (err: any) {
      setError(err?.message ?? "Failed to toggle dev auth.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-extrabold">Admin — Price List</h1>
        <div className="flex items-center gap-6 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              {import.meta.env.DEV && (
                <>
                  <label htmlFor="dev-skip-passwords" className="font-medium">Dev: Skip Passwords</label>
                  <input
                    id="dev-skip-passwords"
                    type="checkbox"
                    checked={skipPasswords}
                    onChange={(e) => toggleDevAuth(e.target.checked)}
                    disabled={busy}
                  />
                </>
              )}
            </div>
            <div className="text-xs text-gray-600">{authStatus}</div>
            {count !== null && (
              <span>
                Rows in DB: <strong>{count}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <button
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                activeTab === "items" ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("items")}
              type="button"
            >
              Items
            </button>
            <button
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                activeTab === "backend" ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("backend")}
              type="button"
            >
              Backend
            </button>
            <button
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                activeTab === "businesses" ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("businesses")}
              type="button"
            >
              Businesses
            </button>
            <button
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
                activeTab === "customers" ? "border-accent text-accent" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("customers")}
              type="button"
            >
              Customers
            </button>
          </nav>
        </div>

        {/* Global alerts */}
        {message && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {activeTab === "items" && (
          <>
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Import Filters</h2>
                <button
                  onClick={async () => {
                    setRulesBusy(true);
                    setError(null);
                    try {
                      const arr = skipPrefixesText
                        .split(/[,\n]/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const res = await fetch("/api/items/rules", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ itemNumberPrefixes: arr }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok || !data?.ok) throw new Error(data?.message || `Save failed (${res.status})`);
                      setMessage("Import filters saved.");
                    } catch (e: any) {
                      setError(e?.message || "Failed to save import filters");
                    } finally {
                      setRulesBusy(false);
                    }
                  }}
                  className="rounded-full px-4 py-2 text-sm font-bold text-white bg-accent shadow-sm disabled:opacity-60"
                  disabled={rulesBusy}
                >
                  {rulesBusy ? "Saving…" : "Save Filters"}
                </button>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Skip Item Number prefixes</label>
              <input
                type="text"
                value={skipPrefixesText}
                onChange={(e) => setSkipPrefixesText(e.target.value)}
                placeholder="e.g. P-, F-, X-"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
              />
              <p className="mt-2 text-xs text-gray-600">Comma or newline separated. Example: P-, F-</p>
            </section>
            <p className="text-sm text-gray-600 mt-6 mb-6">
              Upload your <span className="font-mono">ITEMS</span> file (TSV/CSV/JSON/JSON-Lines). The server parses it and
              stores it in SQLite. Nothing is saved to the browser, and no TXT is stored on disk.
            </p>

        <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Choose ITEMS file
            </label>
            <input
              type="file"
              accept=".txt,.tsv,.csv,application/json,text/plain"
              onChange={onChooseFile}
              className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold hover:file:bg-gray-200"
              disabled={busy}
            />
            {file && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: <span className="font-mono">{file.name}</span>{" "}
                ({file.size.toLocaleString()} bytes)
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={uploadItems}
              disabled={busy || !file}
              className="rounded-full px-5 py-2 font-bold text-white bg-accent shadow-sm hover:scale-105 hover:shadow-xl hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {busy ? "Working…" : "Upload & Import"}
            </button>
            <button
              onClick={refreshCompact}
              disabled={busy}
              className="rounded-full px-5 py-2 font-bold text-accent border border-accent bg-white hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              Refresh Preview
            </button>
            <button
              onClick={clearDatabase}
              disabled={busy}
              className="rounded-full px-5 py-2 font-bold text-white bg-red-600 shadow-sm hover:scale-105 hover:shadow-xl active:scale-95 disabled:opacity-50"
              title="Delete ALL items from the database"
            >
              Clear Database
            </button>
          </div>
        </div>

        {/* Export moved to Backend tab */}

        {/* Search items */}
        <div className="mt-4">
          <label htmlFor="item-search" className="block text-sm font-medium text-gray-700">Search items</label>
          <input
            id="item-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item number, name or description…"
            className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-accent"
          />
        </div>

        <section className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Compact Preview</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Item #
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Product
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Description
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {(() => {
                  const q = search.trim().toLowerCase();
                  const rows = q
                    ? preview.filter((r) =>
                        (r.itemNumber || "").toLowerCase().includes(q) ||
                        (r.productName || "").toLowerCase().includes(q) ||
                        (r.description || "").toLowerCase().includes(q)
                      )
                    : preview;
                  if (rows.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-sm text-gray-500">
                          No items match your search.
                        </td>
                      </tr>
                    );
                  }
                  return rows.map((row, i) => (
                    <tr key={`${row.itemNumber}-${i}`} className="odd:bg-white even:bg-gray-50">
                      <td className="px-3 py-2 text-sm align-top">{row.itemNumber}</td>
                      <td className="px-3 py-2 text-sm align-top">
                        {editing[row.itemNumber] ? (
                          <input
                            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                            value={editing[row.itemNumber].productName}
                            onChange={(e) =>
                              setEditing((m) => ({
                                ...m,
                                [row.itemNumber]: { ...m[row.itemNumber], productName: e.target.value },
                              }))
                            }
                          />
                        ) : (
                          row.productName
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm align-top">
                        {editing[row.itemNumber] ? (
                          <textarea
                            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                            rows={2}
                            value={editing[row.itemNumber].description}
                            onChange={(e) =>
                              setEditing((m) => ({
                                ...m,
                                [row.itemNumber]: { ...m[row.itemNumber], description: e.target.value },
                              }))
                            }
                          />
                        ) : (
                          row.description
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm align-top">
                        {editing[row.itemNumber] ? (
                          <input
                            className="w-32 rounded border border-zinc-300 px-2 py-1 text-sm"
                            value={editing[row.itemNumber].price}
                            onChange={(e) =>
                              setEditing((m) => ({
                                ...m,
                                [row.itemNumber]: { ...m[row.itemNumber], price: e.target.value },
                              }))
                            }
                          />
                        ) : (
                          row.price
                        )}
                        <div className="mt-2">
                          {editing[row.itemNumber] ? (
                            <>
                              <button
                                className="mr-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                                onClick={async () => {
                                  const payload = {
                                    itemNumber: row.itemNumber,
                                    productName: editing[row.itemNumber].productName,
                                    description: editing[row.itemNumber].description,
                                    price: editing[row.itemNumber].price,
                                  };
                                  try {
                                    const res = await fetch("/api/items/update", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify(payload),
                                    });
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok || !data?.ok) throw new Error(data?.message || `Update failed (${res.status})`);
                                    setPreview((list) =>
                                      list.map((r) => (r.itemNumber === row.itemNumber ? { ...r, ...data.item } : r))
                                    );
                                    setEditing((m) => {
                                      const { [row.itemNumber]: _, ...rest } = m;
                                      return rest;
                                    });
                                    setMessage("Item updated");
                                  } catch (e: any) {
                                    setError(e?.message || "Failed to update item");
                                  }
                                }}
                              >
                                Save
                              </button>
                              <button
                                className="rounded-full bg-zinc-300 px-3 py-1 text-xs font-semibold text-zinc-800"
                                onClick={() =>
                                  setEditing((m) => {
                                    const { [row.itemNumber]: _, ...rest } = m;
                                    return rest;
                                  })
                                }
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-semibold text-white"
                              onClick={() =>
                                setEditing((m) => ({
                                  ...m,
                                  [row.itemNumber]: {
                                    productName: row.productName,
                                    description: row.description,
                                    price: row.price,
                                  },
                                }))
                              }
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </section>
          </>
        )}

        {activeTab === "backend" && (
        <>
        <div className="mt-8 p-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Download Project Snapshot</h2>
          <AdminExportButton />
        </div>
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top Level Domains</h2>
            <div className="flex gap-3">
              <button
                onClick={tldUpdate}
                disabled={tldBusy}
                className="rounded-full px-4 py-2 text-sm font-bold text-white bg-accent shadow-sm disabled:opacity-60"
              >
                {tldBusy ? "Working…" : "Update Now"}
              </button>
              <button
                onClick={tldClear}
                disabled={tldBusy}
                className="rounded-full px-4 py-2 text-sm font-bold text-white bg-red-600 shadow-sm disabled:opacity-60"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-700">
            <div>
              Last updated: <span className="font-medium">{tldLastDate ?? "—"}</span>
            </div>
            <div>
              Count (latest set): <span className="font-medium">{tldCount ?? 0}</span>
            </div>
          </div>
        </section>
        </>
        )}

        {activeTab === "customers" && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Customers</h2>
              <button
                onClick={async () => {
                  setCustBusy(true);
                  try {
                    const res = await fetch("/api/customers/admin/list");
                    const data = await res.json();
                    if (!res.ok || !data?.ok) throw new Error(data?.message || `Load failed (${res.status})`);
                    setCustomers(data.customers || []);
                  } catch (e: any) {
                    setError(e?.message || "Failed to load customers");
                  } finally {
                    setCustBusy(false);
                  }
                }}
                className="rounded-full px-4 py-2 text-sm font-bold text-white bg-accent shadow-sm disabled:opacity-60"
                disabled={custBusy}
              >
                {custBusy ? "Loading…" : "Refresh"}
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Created</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Company</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Phone</th>
                    {/* Trade column removed */}
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Admin</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Business</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {customers.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-sm text-gray-500" colSpan={7}>No customers loaded. Click Refresh.</td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c.id} className="odd:bg-white even:bg-gray-50">
                        <td className="px-3 py-2 text-sm">{c.id}</td>
                        <td className="px-3 py-2 text-sm">{c.email}</td>
                        <td className="px-3 py-2 text-sm">{c.name ?? "—"}</td>
                        <td className="px-3 py-2 text-sm">{new Date(c.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2 text-sm">{c.company_name ?? "—"}</td>
                        <td className="px-3 py-2 text-sm">{c.phone ?? "—"}</td>
                        {/* Trade status removed */}
                        <td className="px-3 py-2 text-sm">
                          {c.is_admin ? (
                            <span className="inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">Admin</span>
                          ) : (
                            <span className="inline-block rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-800">User</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">{c.business_id ?? '—'}</td>
                        <td className="px-3 py-2 text-sm">
                          <button
                            className="rounded-full px-3 py-1 text-xs font-semibold text-white bg-zinc-700 hover:brightness-110"
                            onClick={async () => {
                              const pw = window.prompt(`Enter new password for ${c.email}`);
                              if (!pw) return;
                              try {
                                const res = await fetch(`/api/customers/${c.id}/password`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ password: pw }),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok || !data?.ok) throw new Error(data?.message || `Reset failed (${res.status})`);
                                setMessage(`Password reset for ${c.email}`);
                              } catch (e: any) {
                                setError(e?.message || "Failed to reset password");
                              }
                            }}
                          >
                            Reset Password
                          </button>
                          {/* Trade toggle removed */}
                          <button
                            className="ml-2 rounded-full px-3 py-1 text-xs font-semibold text-white bg-purple-600 hover:brightness-110"
                            onClick={async () => {
                              try {
                                const next = c.is_admin ? 0 : 1;
                                const res = await fetch(`/api/customers/${c.id}/admin`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ is_admin: next }),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok || !data?.ok) throw new Error(data?.message || `Toggle failed (${res.status})`);
                                setCustomers((list) => list.map((row) => (row.id === c.id ? { ...row, is_admin: next } : row)));
                                setMessage(`${next ? "Granted" : "Revoked"} admin for ${c.email}`);
                              } catch (e: any) {
                                setError(e?.message || "Failed to toggle admin flag");
                              }
                            }}
                          >
                            {c.is_admin ? "Revoke Admin" : "Grant Admin"}
                          </button>
                          <button
                            className="ml-2 rounded-full px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:brightness-110"
                            onClick={async () => {
                              const input = window.prompt(`Enter Business ID to link for ${c.email} (leave empty to unlink)`, c.business_id ? String(c.business_id) : "");
                              if (input === null) return;
                              const body = input.trim() === "" ? { business_id: null } : { business_id: Number(input.trim()) };
                              try {
                                const res = await fetch(`/api/customers/${c.id}/business`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(body),
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok || !data?.ok) throw new Error(data?.message || `Link failed (${res.status})`);
                                setCustomers((list) => list.map((row) => (row.id === c.id ? { ...row, business_id: data.business_id ?? null } : row)));
                                setMessage(input.trim() === "" ? `Unlinked business for ${c.email}` : `Linked business ${body.business_id} for ${c.email}`);
                              } catch (e: any) {
                                setError(e?.message || "Failed to update business link");
                              }
                            }}
                          >
                            Link Business
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "businesses" && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Businesses</h2>
              <button
                onClick={async () => {
                  setBizBusy(true);
                  try {
                    const res = await fetch("/api/businesses/admin/list");
                    const data = await res.json();
                    if (!res.ok || !data?.ok) throw new Error(data?.message || `Load failed (${res.status})`);
                    setBusinesses(data.businesses || []);
                  } catch (e: any) {
                    setError(e?.message || "Failed to load businesses");
                  } finally {
                    setBizBusy(false);
                  }
                }}
                className="rounded-full px-4 py-2 text-sm font-bold text-white bg-accent shadow-sm disabled:opacity-60"
                disabled={bizBusy}
              >
                {bizBusy ? "Loading…" : "Refresh"}
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">ABN</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Entity Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Business Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Customers</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Created</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {businesses.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-sm text-gray-500" colSpan={6}>No businesses loaded. Click Refresh.</td>
                    </tr>
                  ) : (
                    businesses.map((b) => (
                      <tr key={b.id} className="odd:bg-white even:bg-gray-50">
                        <td className="px-3 py-2 text-sm font-mono">{b.id}</td>
                        <td className="px-3 py-2 text-sm">{b.abn ?? "—"}</td>
                        <td className="px-3 py-2 text-sm">{b.entity_name ?? "—"}</td>
                        <td className="px-3 py-2 text-sm">{b.business_name ?? "—"}</td>
                        <td className="px-3 py-2 text-sm">{b.n_customers}</td>
                        <td className="px-3 py-2 text-sm">{new Date(b.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2 text-sm">
                          <button
                            className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-semibold text-white"
                            onClick={() => setBizEditOpen({
                              id: b.id,
                              abn: b.abn ?? '',
                              entity_name: b.entity_name ?? '',
                              business_name: b.business_name ?? '',
                              delivery_address: b.delivery_address ?? '',
                              billing_address: b.billing_address ?? ''
                            })}
                          >
                            Edit
                          </button>
                          <button
                            className="ml-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white"
                            onClick={() => openBizPricing(b.id)}
                          >
                            Special Pricing
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {bizPricingOpen !== null && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Special Pricing for Business #{bizPricingOpen}</h3>
                  <button className="text-sm text-zinc-600 hover:underline" onClick={() => setBizPricingOpen(null)}>Close</button>
                </div>
                <div className="mt-4 flex items-end gap-3">
                  <div>
                    <label className="block text-xs text-zinc-600">Item Number</label>
                    <input value={newSku} onChange={(e) => setNewSku(e.target.value)} className="mt-1 w-48 rounded border border-zinc-300 px-2 py-1 text-sm" placeholder="e.g. T-123" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-600">Price (e.g. 12.34)</label>
                    <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="mt-1 w-32 rounded border border-zinc-300 px-2 py-1 text-sm" placeholder="$0.00" />
                  </div>
                  <button
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={async () => {
                      if (!newSku.trim() || !newPrice.trim() || bizPricingOpen == null) return;
                      try {
                        const res = await fetch(`/api/businesses/${bizPricingOpen}/pricing`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ itemNumber: newSku.trim(), price: newPrice.trim() })
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || !data?.ok) throw new Error(data?.message || `Save failed (${res.status})`);
                        setNewSku(''); setNewPrice('');
                        await openBizPricing(bizPricingOpen);
                        setMessage('Special price saved');
                      } catch (e: any) {
                        setError(e?.message || 'Failed to save price');
                      }
                    }}
                  >
                    Add / Update
                  </button>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item Number</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Price</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {bizPricing.length === 0 ? (
                        <tr><td className="px-3 py-3 text-sm text-gray-500" colSpan={3}>No special prices</td></tr>
                      ) : (
                        bizPricing.map((p) => (
                          <tr key={p.itemNumber}>
                            <td className="px-3 py-2 text-sm font-mono">{p.itemNumber}</td>
                            <td className="px-3 py-2 text-sm">${(p.priceCents/100).toFixed(2)}</td>
                            <td className="px-3 py-2 text-sm">
                              <button
                                className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                                onClick={async () => {
                                  if (bizPricingOpen == null) return;
                                  try {
                                    const res = await fetch(`/api/businesses/${bizPricingOpen}/pricing/${encodeURIComponent(p.itemNumber)}`, { method: 'DELETE' });
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok || !data?.ok) throw new Error(data?.message || `Delete failed (${res.status})`);
                                    await openBizPricing(bizPricingOpen);
                                  } catch (e: any) {
                                    setError(e?.message || 'Failed to delete price');
                                  }
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {bizEditOpen && (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Edit Business #{bizEditOpen.id}</h3>
                  <button className="text-sm text-zinc-600 hover:underline" onClick={() => setBizEditOpen(null)}>Close</button>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block text-sm">ABN
                    <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" value={bizEditOpen.abn} onChange={e => setBizEditOpen(v => v && ({...v, abn: e.target.value}))} />
                  </label>
                  <label className="block text-sm">Entity Name
                    <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" value={bizEditOpen.entity_name} onChange={e => setBizEditOpen(v => v && ({...v, entity_name: e.target.value}))} />
                  </label>
                  <label className="block text-sm">Business Name
                    <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" value={bizEditOpen.business_name} onChange={e => setBizEditOpen(v => v && ({...v, business_name: e.target.value}))} />
                  </label>
                  <label className="block text-sm">Delivery Address
                    <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" value={bizEditOpen.delivery_address} onChange={e => setBizEditOpen(v => v && ({...v, delivery_address: e.target.value}))} />
                  </label>
                  <label className="block text-sm">Billing Address
                    <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" value={bizEditOpen.billing_address} onChange={e => setBizEditOpen(v => v && ({...v, billing_address: e.target.value}))} />
                  </label>
                </div>
                <div className="mt-4">
                  <button
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                    onClick={async () => {
                      if (!bizEditOpen) return;
                      try {
                        const res = await fetch(`/api/businesses/${bizEditOpen.id}`, {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(bizEditOpen)
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || !data?.ok) throw new Error(data?.message || `Update failed (${res.status})`);
                        setMessage('Business updated');
                        setBizEditOpen(null);
                        // refresh list
                        setBizBusy(true);
                        try {
                          const res2 = await fetch("/api/businesses/admin/list");
                          const data2 = await res2.json();
                          if (res2.ok && data2?.ok) setBusinesses(data2.businesses || []);
                        } finally { setBizBusy(false); }
                      } catch (e: any) {
                        setError(e?.message || 'Failed to update business');
                      }
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
