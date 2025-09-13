//apps/web/src/pages/PricingPage.tsx

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type ItemRow = { productName: string; description: string; price: string; specialPrice?: string };

const PricingPage = () => {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/items/compact", { credentials: 'include' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: ItemRow[] = await response.json();
        setItems(data);
      } catch (err: any) {
        console.error("Failed to fetch items:", err);
        setError(err.message ?? "Failed to load items");
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  return (
    <div>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Pricing</h1>

        {loading && <p>Loading items…</p>}
        {error && <p className="text-red-600">Error: {error}</p>}

        {!loading && !error && (
          <table className="w-full border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border">Product</th>
                <th className="p-2 border">Description</th>
                <th className="p-2 border">Price</th>
                {items.some(i => i.specialPrice) && (
                  <th className="p-2 border">Special Price</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 border">{item.productName}</td>
                  <td className="p-2 border">{item.description}</td>
                  <td className="p-2 border">{item.price}</td>
                  {items.some(i => i.specialPrice) && (
                    <td className="p-2 border">{item.specialPrice ?? '—'}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-6">
          <Link to="/" className="text-blue-600 hover:underline">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
};

export default PricingPage;
