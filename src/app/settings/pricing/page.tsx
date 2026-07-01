'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';

type CollectionRow = {
  collection: string;
  supplierCost: number;
  markup: number;
  retailPrice: number;
  hasPricing: boolean;
};

export default function PricingSettingsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(0);

  useEffect(() => {
    fetchCollections();
  }, []);

  async function fetchCollections() {
    try {
      const res = await fetch('/api/company-collections');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        // Transform: if they have supplier_cost and retail_price, calculate markup
        const transformed = data.map((c: any) => {
          const supplierCost = Number(c.supplier_cost || 0);
          const retailPrice = Number(c.retail_price || 0);
          const markup = retailPrice - supplierCost;
          return {
            collection: c.collection,
            supplierCost: supplierCost,
            markup: markup,
            retailPrice: retailPrice,
            hasPricing: !!c.supplier_cost,
          };
        });
        setCollections(transformed);
      } else {
        setError('Failed to load collections');
      }
    } catch (err) {
      setError('Unable to load collections');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccessCount(0);

    try {
      let savedCount = 0;
      const promises = collections.map(collection =>
        fetch('/api/company-collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collection: collection.collection,
            supplier_cost: collection.supplierCost,
            retail_price: collection.retailPrice,
          }),
        }).then(res => {
          if (res.ok) savedCount++;
        })
      );

      await Promise.all(promises);
      setSuccessCount(savedCount);
      setSaving(false);

      setTimeout(() => setSuccessCount(0), 3000);
    } catch (err) {
      setError('Failed to save pricing. Please try again.');
      setSaving(false);
    }
  }

  function updateCollectionPrice(collectionName: string, field: 'supplierCost' | 'markup', value: string) {
    setCollections(prev => {
      return prev.map(c => {
        if (c.collection === collectionName) {
          const supplierCost = field === 'supplierCost' ? parseFloat(value) || 0 : c.supplierCost;
          const markup = field === 'markup' ? parseFloat(value) || 0 : c.markup;
          const retailPrice = supplierCost + markup;
          return { ...c, supplierCost, markup, retailPrice };
        }
        return c;
      });
    });
  }

  const filtered = collections.filter(
    (c) => c.collection.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <a
              href="/settings"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to Settings
            </a>
          </div>
          <h1 className="text-xl font-semibold">Product Pricing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your supplier costs and markup by blinds family (collection). Retail prices are auto-calculated.
          </p>
        </div>

        {successCount > 0 && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mb-4">
            ✓ Saved pricing for {successCount} collection{successCount > 1 ? 's' : ''}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center">
            <input
              className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Search collections…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="text-sm text-gray-500">
              {filtered.length} collection{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading collections...</div>
          ) : error && !collections.length ? (
            <div className="p-12 text-center text-red-600">{error}</div>
          ) : !collections || collections.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No collections found. Add products with collections first.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Collection</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Products</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">
                    Supplier Cost
                    <span className="block text-xs text-gray-400 font-normal">(₱/sq.ft.)</span>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">
                    Markup
                    <span className="block text-xs text-gray-400 font-normal">(₱/sq.ft.)</span>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">
                    Retail Price
                    <span className="block text-xs text-gray-400 font-normal">(₱/sq.ft.)</span>
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const margin = c.retailPrice > 0 ? ((c.markup / c.retailPrice) * 100).toFixed(1) : '0.0';

                  return (
                    <tr key={c.collection} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.collection}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.collection && (
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            All {c.collection} blinds
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                          value={c.supplierCost || ''}
                          onChange={(e) => updateCollectionPrice(c.collection, 'supplierCost', e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                          value={c.markup || ''}
                          onChange={(e) => updateCollectionPrice(c.collection, 'markup', e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700 bg-blue-50">
                        ₱{c.retailPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {parseFloat(margin) > 0 ? (
                          <span className="text-blue-700">{margin}%</span>
                        ) : (
                          <span className="text-gray-400">0.0%</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {error && collections.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.push('/settings')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : `Save All Pricing (${collections.length} collection${collections.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
