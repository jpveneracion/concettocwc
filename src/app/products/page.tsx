'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import type { Product } from '@/types';

type ProductRow = { code: string; description: string; _key: string };

const emptySharedState = { collection: '', supplier_cost: '', markup_price: '' };

function newRow(): ProductRow {
  return { code: '', description: '', _key: crypto.randomUUID() };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [shared, setShared] = useState(emptySharedState);
  const [productRows, setProductRows] = useState<ProductRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        setError(data?.error || 'Failed to load products.');
        setProducts(null);
      } else {
        setProducts(data);
        setError(null);
      }
    } catch (err) {
      console.error('Fetch products failed', err);
      setError('Unable to load products.');
      setProducts(null);
    } finally {
      setLoading(false);
    }
  }

  function addProductRow() {
    setProductRows((prev) => [...prev, newRow()]);
  }

  function removeProductRow(key: string) {
    if (productRows.length > 1) {
      setProductRows((prev) => prev.filter((r) => r._key !== key));
    }
  }

  function updateProductRow(key: string, field: 'code' | 'description', value: string) {
    setProductRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  }

  async function saveProducts() {
    const validRows = productRows.filter((r) => r.code.trim() && r.description.trim());
    if (validRows.length === 0) {
      alert('Add at least one product code and description.'); return;
    }
    if (!shared.collection.trim()) {
      alert('Collection is required.'); return;
    }

    const supplierCost = parseFloat(shared.supplier_cost) || 0;
    const markupPrice = parseFloat(shared.markup_price) || 0;
    const retailPrice = supplierCost + markupPrice;

    setSaving(true);

    const promises = validRows.map((row) =>
      fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: row.code.toUpperCase(),
          collection: shared.collection,
          description: row.description,
          supplier_cost: supplierCost,
          retail_price: retailPrice,
          unit: 'sqft',
        }),
      })
    );

    await Promise.all(promises);
    setSaving(false);
    setShared(emptySharedState);
    setProductRows([newRow()]);
    setShowForm(false);
    fetchProducts();
  }

  async function deleteProduct(id: string, code: string) {
    if (!confirm(`Delete product ${code}?`)) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    fetchProducts();
  }

  const filtered = products.filter(
    (p) =>
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.collection?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Products</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {showForm ? '✕ Cancel' : '➕ Add product'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h3 className="font-medium text-sm text-gray-700 mb-4">Add products (batch)</h3>

          {/* Upper Part: Collection, Supplier Cost, Mark Up Price, Retail Price */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Collection</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={shared.collection} onChange={(e) => setShared({ ...shared, collection: e.target.value })} placeholder="e.g. Picasso" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supplier cost (₱/sq.ft.)</label>
              <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={shared.supplier_cost} onChange={(e) => setShared({ ...shared, supplier_cost: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mark Up Price (₱/sq.ft.)</label>
              <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={shared.markup_price} onChange={(e) => setShared({ ...shared, markup_price: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Retail Price (₱/sq.ft.)</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 font-medium"
                value={((parseFloat(shared.supplier_cost) || 0) + (parseFloat(shared.markup_price) || 0)).toFixed(2)}
                readOnly
              />
            </div>
          </div>

          {/* Lower Part: Multiple Product Code + Description rows */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-medium text-gray-600">Products ({productRows.length})</h4>
              <button onClick={addProductRow} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">
                ➕ Add product
              </button>
            </div>
            <div className="space-y-2">
              {productRows.map((row, idx) => (
                <div key={row._key} className="grid grid-cols-5 gap-2 items-start">
                  <div className="col-span-1">
                    <label className="block text-xs text-gray-500 mb-1">#{idx + 1} Code</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase"
                      value={row.code}
                      onChange={(e) => updateProductRow(row._key, 'code', e.target.value.toUpperCase())}
                      placeholder="e.g. P5012"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Description / color</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      value={row.description}
                      onChange={(e) => updateProductRow(row._key, 'description', e.target.value)}
                      placeholder="e.g. Picasso Khaki"
                    />
                  </div>
                  <div className="col-span-1 pt-5">
                    {productRows.length > 1 && (
                      <button
                        onClick={() => removeProductRow(row._key)}
                        className="px-2 py-2 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 w-full"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-400">All products will be saved with the same collection and pricing above.</p>
            <button onClick={saveProducts} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? `Saving ${productRows.length} products...` : `💾 Save ${productRows.length} product${productRows.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-gray-100">
          <input className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Search by code, name, or collection…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">{error}</div>
        ) : !products || products.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No products found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {['Code', 'Collection', 'Description', 'Supplier cost', 'Mark Up', 'Retail price', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const supplierCost = Number(p.supplier_cost);
                const retailPrice = Number(p.retail_price);
                const markUp = retailPrice - supplierCost;
                return (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium">{p.code}</td>
                    <td className="px-4 py-3 text-gray-500">{p.collection}</td>
                    <td className="px-4 py-3">{p.description}</td>
                    <td className="px-4 py-3">₱{supplierCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-green-700">₱{markUp.toFixed(2)}</td>
                    <td className="px-4 py-3 font-medium text-blue-700">₱{retailPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteProduct(p.id, p.code)} className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50">🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
