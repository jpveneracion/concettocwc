'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import ResponsiveTable from '@/components/ResponsiveTable';
import { useAdminNotifications } from '@/contexts/AdminNotificationContext';
import type { CompanyProductDefinition, CompanyProductWithCompanyName } from '@/types/company-product';

export default function AdminCompanyProductsPage() {
  const { refreshNotifications } = useAdminNotifications();
  const [pendingProducts, setPendingProducts] = useState<CompanyProductWithCompanyName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CompanyProductWithCompanyName | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingProducts();
  }, []);

  async function fetchPendingProducts() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/company-products/pending-promotion');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load pending products');
      }

      setPendingProducts(data.products || []);
      setError(null);
    } catch (err) {
      console.error('Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending products');
    } finally {
      setLoading(false);
    }
  }

  async function promoteProduct(productId: string) {
    if (!reviewNotes.trim()) {
      alert('Please add review notes before promoting');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/admin/company-products/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_product_id: productId,
          review_notes: reviewNotes
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to promote product');
      }

      alert('Product promoted to global catalog successfully');
      setSelectedProduct(null);
      setReviewNotes('');
      await fetchPendingProducts();
      await refreshNotifications(); // Refresh admin notifications
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to promote product');
    } finally {
      setProcessing(false);
    }
  }

  const filteredProducts = pendingProducts.filter(product =>
    product.code.toLowerCase().includes(search.toLowerCase()) ||
    product.description.toLowerCase().includes(search.toLowerCase()) ||
    (product.collection && product.collection.toLowerCase().includes(search.toLowerCase()))
  );

  // Mobile card render
  const renderMobileCard = useCallback((product: CompanyProductWithCompanyName) => {
    return (
      <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-lg font-mono">{product.code}</div>
            <div className="text-gray-600 text-sm">{product.collection || 'No collection'}</div>
          </div>
          <div className="text-xs text-gray-500">{product.unit}</div>
        </div>

        <div className="text-sm text-gray-700">{product.description}</div>

        <div className="text-xs text-gray-500 space-y-1">
          <div>Company: {product.company_name || 'Unknown'}</div>
          <div>Submitted: {new Date(product.created_at).toLocaleDateString()}</div>
        </div>

        <button
          onClick={() => setSelectedProduct(product)}
          className="w-full px-3 py-2 text-sm border border-blue-200 text-blue-600 rounded hover:bg-blue-50"
        >
          Review for Promotion
        </button>
      </div>
    );
  }, []);

  // Desktop table render
  const renderDesktopTable = useCallback(() => {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Code</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Collection</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Description</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Company</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Unit</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Submitted</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map(product => (
            <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-medium">{product.code}</td>
              <td className="px-4 py-3 text-gray-500">{product.collection || '-'}</td>
              <td className="px-4 py-3">{product.description}</td>
              <td className="px-4 py-3 text-gray-600">{product.company_name || 'Unknown'}</td>
              <td className="px-4 py-3">{product.unit}</td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(product.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => setSelectedProduct(product)}
                  className="px-3 py-1 text-xs border border-blue-200 text-blue-600 rounded hover:bg-blue-50"
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [filteredProducts]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Products</h1>
          <p className="text-gray-600 mt-1">
            Review and promote company-specific products to global catalog
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-800">Awaiting Review</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">
              {pendingProducts.filter(p => !p.is_approved_for_global).length}
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-800">Promoted to Global</div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              {pendingProducts.filter(p => p.is_approved_for_global).length}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <input
            type="text"
            placeholder="Search by code, description, or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* Products List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-400">Loading company products...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No company products found
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <ResponsiveTable
              data={filteredProducts}
              renderCard={renderMobileCard}
              renderTable={renderDesktopTable}
              emptyMessage="No products found"
            />
          </div>
        )}

        {/* Review Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Review Product: {selectedProduct.code}
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <div className="text-gray-900">{selectedProduct.description}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Collection
                  </label>
                  <div className="text-gray-900">{selectedProduct.collection || 'N/A'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <div className="text-gray-900">{selectedProduct.unit}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <div className="text-gray-900">{selectedProduct.company_name || 'Unknown'}</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Review Notes *
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this promotion decision..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => promoteProduct(selectedProduct.id)}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processing ? 'Processing...' : '✅ Promote to Global'}
                </button>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setReviewNotes('');
                  }}
                  disabled={processing}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}