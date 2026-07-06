'use client';
import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import ResponsiveTable from '@/components/ResponsiveTable';
import type { Product } from '@/types';

type ProductRow = { code: string; description: string; _key: string };

const emptySharedState = { collection: '' };

function newRow(): ProductRow {
  return { code: '', description: '', _key: crypto.randomUUID() };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [shared, setShared] = useState(emptySharedState);
  const [productRows, setProductRows] = useState<ProductRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        setError(data?.error || 'Failed to load products.');
        setProducts([]);
      } else {
        setProducts(data);
        setError(null);
      }
    } catch (err) {
      console.error('Fetch products failed', err);
      setError('Unable to load products.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addProductRow = useCallback(() => {
    setProductRows((prev) => [...prev, newRow()]);
  }, []);

  const removeProductRow = useCallback((key: string) => {
    setProductRows((prev) => {
      if (prev.length > 1) {
        return prev.filter((r) => r._key !== key);
      }
      return prev;
    });
  }, []);

  const updateProductRow = useCallback((key: string, field: 'code' | 'description', value: string) => {
    setProductRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  }, []);

  const saveProducts = useCallback(async () => {
    const validRows = productRows.filter((r) => r.code.trim() && r.description.trim());
    if (validRows.length === 0) {
      alert('Add at least one product code and description.'); return;
    }
    if (!shared.collection.trim()) {
      alert('Collection is required.'); return;
    }

    setSaving(true);

    try {
      const promises = validRows.map((row) =>
        fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: row.code.toUpperCase(),
            collection: shared.collection,
            description: row.description,
            unit: 'sqft',
          }),
        })
      );

      await Promise.all(promises);
      setShared(emptySharedState);
      setProductRows([newRow()]);
      setShowForm(false);
      await fetchProducts();
    } catch (err) {
      console.error('Save products failed', err);
      alert('Failed to save products. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [productRows, shared.collection, fetchProducts]);

  const deleteProduct = useCallback(async (id: string, code: string) => {
    if (!window.confirm(`Delete product ${code}?`)) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        console.error('Delete failed:', error?.error || 'Unknown error');
        return;
      }
      await fetchProducts();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }, [fetchProducts]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = (products || []).filter(
    (p) =>
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.collection?.toLowerCase().includes(search.toLowerCase())
  );

  // Mobile card render function
  const renderMobileCard = useCallback((product: Product, index: number) => {
    return (
      <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        {/* Card header */}
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-lg font-mono">{product.code}</div>
            <div className="text-gray-600 text-sm">{product.collection}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Unit: {product.unit}</div>
          </div>
        </div>

        {/* Card body */}
        <div className="space-y-1 text-sm">
          <div className="text-gray-700">{product.description}</div>
        </div>

        {/* Card actions */}
        <div className="pt-2 border-t border-gray-100">
          <button
            onClick={() => deleteProduct(product.id, product.code)}
            className="w-full px-3 py-2 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50"
            aria-label="Delete product"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    );
  }, [deleteProduct]);

  // Desktop table render function
  const renderDesktopTable = useCallback(() => {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {['Code', 'Collection', 'Description', 'Unit', ''].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-medium">{p.code}</td>
              <td className="px-4 py-3 text-gray-500">{p.collection}</td>
              <td className="px-4 py-3">{p.description}</td>
              <td className="px-4 py-3">{p.unit}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => deleteProduct(p.id, p.code)}
                  className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                  aria-label="Delete product"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [filtered, deleteProduct]);

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-4 md:mb-6">
        <h1 className="text-lg font-semibold md:text-xl">Products</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          aria-label={showForm ? 'Cancel adding product' : 'Add product'}
        >
          {showForm ? '✕ Cancel' : '➕ Add product'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h3 className="font-medium text-sm text-gray-700 mb-4">Add products (batch)</h3>
          <p className="text-xs text-gray-500 mb-4">Note: Pricing is set per-company in Settings. Products here are shared across all companies.</p>

          {/* Collection */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Collection</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={shared.collection} onChange={(e) => setShared({ ...shared, collection: e.target.value })} placeholder="e.g. Picasso" />
            </div>
          </div>

          {/* Product Code + Description rows */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-medium text-gray-600">Products ({productRows.length})</h4>
              <button
                onClick={addProductRow}
                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                aria-label="Add product row"
              >
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
                        aria-label="Remove product row"
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
            <p className="text-xs text-gray-400">All products will be saved with the collection above.</p>
            <button
              onClick={saveProducts}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              aria-label="Save products"
            >
              {saving ? `Saving ${productRows.length} products...` : `💾 Save ${productRows.length} product${productRows.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-3 border-b border-gray-100">
          <input
            className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Search by code, name, or collection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products"
          />
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">{error}</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No products found.</div>
        ) : (
          <ResponsiveTable
            data={filtered}
            renderCard={renderMobileCard}
            renderTable={renderDesktopTable}
            emptyMessage="No products found."
          />
        )}
      </div>
    </AppLayout>
  );
}
