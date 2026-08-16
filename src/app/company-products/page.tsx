'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Plus, X, Save } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ResponsiveTable from '@/components/ResponsiveTable';
import { ActionDropdown } from '@/components/ui/ActionDropdown';
import type { CompanyProductDefinition } from '@/types/company-product';
import type { ProductUnit } from '@/types/product';

const emptyFormState = { code: '', collection: '', description: '', unit: 'sqft' as const };

function newRow() {
  return { ...emptyFormState, _key: crypto.randomUUID() };
}

export default function CompanyProductsPage() {
  const [products, setProducts] = useState<CompanyProductDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formRows, setFormRows] = useState([newRow()]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [editingProduct, setEditingProduct] = useState<CompanyProductDefinition | null>(null);
  const [editForm, setEditForm] = useState({ collection: '', description: '', unit: 'sqft' as ProductUnit });

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        ...(search && { search })
      });

      const res = await fetch(`/api/company-products/definitions?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch products');
      }

      setProducts(data.products || []);
      setError(null);
    } catch (err) {
      console.error('Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  const addProductRow = useCallback(() => {
    setFormRows(prev => [...prev, newRow()]);
  }, []);

  const removeProductRow = useCallback((key: string) => {
    setFormRows(prev => {
      if (prev.length > 1) {
        return prev.filter(row => row._key !== key);
      }
      return prev;
    });
  }, []);

  const updateProductRow = useCallback((key: string, field: string, value: string) => {
    setFormRows(prev =>
      prev.map(row => (row._key === key ? { ...row, [field]: value } : row))
    );
  }, []);

  const saveProducts = useCallback(async () => {
    const validRows = formRows.filter(row => row.code.trim() && row.description.trim());

    if (validRows.length === 0) {
      alert('Add at least one product code and description.');
      return;
    }

    setSaving(true);

    try {
      const promises = validRows.map(row =>
        fetch('/api/company-products/definitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: row.code.toUpperCase(),
            collection: row.collection || undefined,
            description: row.description,
            unit: row.unit
          })
        })
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => !r.ok);

      if (errors.length > 0) {
        const errorMessages = await Promise.all(
          errors.map(async r => {
            const data = await r.json();
            return data.error || 'Unknown error';
          })
        );
        alert(`Some products failed to save:\n${errorMessages.join('\n')}`);
      } else {
        setFormRows([newRow()]);
        setShowForm(false);
        await fetchProducts();
      }
    } catch (err) {
      console.error('Save products failed:', err);
      alert('Failed to save products. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [formRows, fetchProducts]);

  const deleteProduct = useCallback(async (id: string, code: string) => {
    if (!window.confirm(`Delete company product ${code}?`)) return;

    try {
      const res = await fetch(`/api/company-products/definitions/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete product');
        return;
      }

      await fetchProducts();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete product');
    }
  }, [fetchProducts]);

  const startEdit = useCallback((product: CompanyProductDefinition) => {
    if (product.is_approved_for_global) {
      alert('Cannot edit promoted products');
      return;
    }
    setEditingProduct(product);
    setEditForm({
      collection: product.collection || '',
      description: product.description,
      unit: product.unit
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingProduct(null);
    setEditForm({ collection: '', description: '', unit: 'sqft' as ProductUnit });
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingProduct) return;

    try {
      const res = await fetch(`/api/company-products/definitions/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update product');
        return;
      }

      cancelEdit();
      await fetchProducts();
    } catch (err) {
      console.error('Update failed:', err);
      alert('Failed to update product');
    }
  }, [editingProduct, editForm, fetchProducts, cancelEdit]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Mobile card render
  const renderMobileCard = useCallback((product: CompanyProductDefinition) => {
    return (
      <div key={product.id} className="bg-white border border-stone-200 rounded-lg p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-lg font-mono">{product.code}</div>
            <div className="text-stone-600 text-sm">{product.collection || 'No collection'}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
              product.is_approved_for_global
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-100'
            }`}>
              {product.is_approved_for_global ? 'Global' : 'Company'}
            </span>
            <span className="text-xs text-stone-500">{product.unit}</span>
          </div>
        </div>

        <div className="text-sm text-stone-700">{product.description}</div>

        <div className="text-xs text-stone-400">
          Added: {new Date(product.created_at).toLocaleDateString()}
        </div>

        {!product.is_approved_for_global && (
          <div className="flex gap-2 pt-2 border-t border-stone-100">
            <button
              onClick={() => startEdit(product)}
              className="flex-1 px-3 py-2 text-sm border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => deleteProduct(product.id, product.code)}
              className="flex-1 px-3 py-2 text-sm border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }, [startEdit, deleteProduct]);

  // Desktop table render
  const renderDesktopTable = useCallback(() => {
    return (
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">Code</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">Collection</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">Description</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">Unit</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-200">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id} className="hover:bg-slate-50 transition-colors duration-150">
              <td className="px-4 py-3 font-mono font-medium text-stone-900">{product.code}</td>
              <td className="px-4 py-3 text-stone-500">{product.collection || '-'}</td>
              <td className="px-4 py-3 text-stone-900">{product.description}</td>
              <td className="px-4 py-3 text-stone-600">{product.unit}</td>
              <td className="px-4 py-3">
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                  product.is_approved_for_global
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}>
                  {product.is_approved_for_global ? 'Global' : 'Company'}
                </span>
              </td>
              <td className="px-4 py-3">
                {!product.is_approved_for_global && (
                  <ActionDropdown
                    onEdit={() => startEdit(product)}
                    onDelete={() => deleteProduct(product.id, product.code)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }, [products, startEdit, deleteProduct]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-semibold md:text-xl">Company Products</h1>
            <p className="text-sm text-stone-600 mt-1">
              Your company-specific product catalog
            </p>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors inline-flex items-center gap-2"
          >
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Product
              </>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-stone-200 rounded-lg text-sm"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | 'pending' | 'approved')}
            className="px-4 py-2 border border-stone-200 rounded-lg text-sm"
          >
            <option value="all">All Products</option>
            <option value="pending">Company Only</option>
            <option value="approved">In Global Catalog</option>
          </select>
        </div>

        {/* Add Product Form */}
        {showForm && (
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <h3 className="font-medium text-sm text-stone-700 mb-4">Add Company Products</h3>
            <p className="text-xs text-stone-500 mb-4">
              These products are immediately available in your company catalog. Admins can promote them to the global catalog.
            </p>

            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-medium text-stone-600">Products ({formRows.length})</h4>
                <button
                  onClick={addProductRow}
                  className="text-xs px-2 py-1 border border-stone-300 rounded hover:bg-stone-50 inline-flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Product
                </button>
              </div>

              {formRows.map((row, idx) => (
                <div key={row._key} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start">
                  <div className="md:col-span-1">
                    <label className="block text-xs text-stone-500 mb-1">#{idx + 1} Code</label>
                    <input
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm uppercase"
                      value={row.code}
                      onChange={e => updateProductRow(row._key, 'code', e.target.value.toUpperCase())}
                      placeholder="P5012"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-stone-500 mb-1">Collection</label>
                    <input
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                      value={row.collection}
                      onChange={e => updateProductRow(row._key, 'collection', e.target.value)}
                      placeholder="Picasso"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-stone-500 mb-1">Description</label>
                    <input
                      className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"
                      value={row.description}
                      onChange={e => updateProductRow(row._key, 'description', e.target.value)}
                      placeholder="Picasso Khaki"
                    />
                  </div>
                  <div className="md:col-span-1 pt-5 flex gap-2">
                    {formRows.length > 1 && (
                      <button
                        onClick={() => removeProductRow(row._key)}
                        className="px-2 py-2 text-xs border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex items-center justify-center"
                        aria-label="Remove product row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4">
              <p className="text-xs text-stone-400">Products available immediately in your company catalog</p>
              <button
                onClick={saveProducts}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {saving ? 'Saving...' : (
                  <>
                    <Save className="w-4 h-4" />
                    Save {formRows.length} product{formRows.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editingProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h3 className="text-lg font-bold text-stone-900 mb-4">
                Edit Product: {editingProduct.code}
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Code</label>
                  <input
                    disabled
                    value={editingProduct.code}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Collection</label>
                  <input
                    value={editForm.collection}
                    onChange={e => setEditForm({ ...editForm, collection: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                    placeholder="Collection name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                    placeholder="Product description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Unit</label>
                  <select
                    value={editForm.unit}
                    onChange={e => setEditForm({ ...editForm, unit: e.target.value as ProductUnit })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  >
                    <option value="sqft">Square Feet (sqft)</option>
                    <option value="sqm">Square Meters (sqm)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveEdit}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save Changes
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products List */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-stone-400">Loading...</div>
          ) : error ? (
            <div className="p-12 text-center text-red-600">{error}</div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-stone-400">No company products found</div>
          ) : (
            <ResponsiveTable
              data={products}
              renderCard={renderMobileCard}
              renderTable={renderDesktopTable}
              emptyMessage="No products found"
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}