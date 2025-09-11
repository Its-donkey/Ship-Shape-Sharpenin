import React, { useState } from "react";
import AdminExportButton from "../components/ZipExportButton"; // adjust path if needed

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

type CompactRow = { productName: string; description: string; price: string };

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CompactRow[]>([]);
  const [count, setCount] = useState<number | null>(null);

  const onChooseFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setFile(e.target.files?.[0] ?? null);
    setMessage(null);
    setError(null);
  };

  async function refreshCompact() {
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
      setMessage(`Loaded ${compact.length} items from server.`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load preview.");
    } finally {
      setBusy(false);
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

  return (
    <div>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-extrabold">Admin — Price List</h1>
          <div className="text-sm text-gray-600">
            {count !== null && <span>Rows in DB: <strong>{count}</strong></span>}
          </div>
        </div>

        <p className="text-sm text-gray-600 mt-2 mb-6">
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

    <div className="p-6 space-y-6">
      {/* your existing admin UI… */}
      <AdminExportButton />
    </div>
        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Compact Preview</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                {preview.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-sm text-gray-500">
                      No items loaded yet. Upload a file or click “Refresh Preview”.
                    </td>
                  </tr>
                ) : (
                  preview.map((row, i) => (
                    <tr key={`${row.productName}-${i}`} className="odd:bg-white even:bg-gray-50">
                      <td className="px-3 py-2 text-sm">{row.productName}</td>
                      <td className="px-3 py-2 text-sm">{row.description}</td>
                      <td className="px-3 py-2 text-sm">{row.price}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
