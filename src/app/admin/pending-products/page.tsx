'use client';

import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import type { PendingProduct, ProductReviewStats } from '@/types/product';

export default function PendingProductsPage() {
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const [stats, setStats] = useState<ProductReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Review actions
  const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingProducts();
  }, []);

  async function fetchPendingProducts() {
    try {
      setLoading(true);
      const res = await fetch('/api/pending-products');
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

  async function approveProduct(productId: string) {
    if (!reviewNotes.trim()) {
      alert('Please add review notes before approving');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/pending-products/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pending_product_id: productId,
          review_notes: reviewNotes
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve product');
      }

      alert(data.message || 'Product approved successfully');
      setSelectedProduct(null);
      setReviewNotes('');
      await fetchPendingProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve product');
    } finally {
      setProcessing(false);
    }
  }

  async function rejectProduct(productId: string) {
    if (!reviewNotes.trim()) {
      alert('Please add review notes before rejecting');
      return;
    }

    if (!window.confirm('Are you sure you want to reject this product?')) {
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/pending-products/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pending_product_id: productId,
          review_notes: reviewNotes
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject product');
      }

      alert(data.message || 'Product rejected successfully');
      setSelectedProduct(null);
      setReviewNotes('');
      await fetchPendingProducts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject product');
    } finally {
      setProcessing(false);
    }
  }

  const filteredProducts = pendingProducts.filter(product =>
    product.code.toLowerCase().includes(search.toLowerCase()) ||
    product.description.toLowerCase().includes(search.toLowerCase()) ||
    (product.collection && product.collection.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Products</h1>
          <p className="text-gray-600 mt-1">
            Review and approve merchant-submitted products
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-800">Pending Review</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">
              {pendingProducts.filter(p => p.status === 'pending').length}
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-800">Approved Today</div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              {pendingProducts.filter(p => p.status === 'approved').length}
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800">Rejected Today</div>
            <div className="text-2xl font-bold text-red-900 mt-1">
              {pendingProducts.filter(p => p.status === 'rejected').length}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <input
            type="text"
            placeholder="Search by code, description, or collection..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* Loading / Error */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-pulse text-gray-400">Loading pending products...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No pending products found
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold font-mono">{product.code}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        product.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        product.status === 'approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {product.status}
                      </span>
                    </div>
                    <div className="text-gray-600 mb-1">{product.description}</div>
                    <div className="text-sm text-gray-500">
                      Collection: {product.collection || 'N/A'} • Unit: {product.unit}
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      Submitted: {new Date(product.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {product.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Review
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
                    Review Notes *
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about your decision..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => approveProduct(selectedProduct.id)}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {processing ? 'Processing...' : '✅ Approve'}
                </button>
                <button
                  onClick={() => rejectProduct(selectedProduct.id)}
                  disabled={processing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {processing ? 'Processing...' : '❌ Reject'}
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
    </AppLayout>
  );
}