//apps/web/src/components/ZipExportButton.tsx

// apps/web/src/components/AdminExportButton.tsx
import React, { useState } from "react";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminExportButton() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleClick = async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/export/zip", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      // Try to get filename from header; fallback
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "Ship-Shape-Review.zip";
      downloadBlob(blob, filename);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to download");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="px-4 py-2 rounded-2xl shadow border hover:shadow-md disabled:opacity-60"
        title="Zips source & configs (excludes node_modules/build/etc.)"
      >
        {loading ? "Preparing zip…" : "Download Project Snapshot (.zip)"}
      </button>
      {err && <span className="text-red-600 text-sm">{err}</span>}
    </div>
  );
}
