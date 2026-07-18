'use client';

import { useState, useEffect } from 'react';

interface PromoCode {
  id: number;
  code: string;
  discount_percent: number;
  applicable_plans: string[];
  gcash_qr_url?: string;
  gotyme_qr_url?: string;
  usage_limit?: number;
  current_usage?: number;
  expires_at?: string;
  is_active: boolean;
  campaign_name?: string;
  notes?: string;
  created_at: string;
}

export default function PromoCodeManager() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New promo code form state
  const [newPromo, setNewPromo] = useState({
    code: '', // Empty = auto-generate
    discount_percent: 10,
    applicable_plans: ['monthly'] as string[],
    usage_limit: 100,
    expires_at: '',
    campaign_name: '',
    notes: '',
    gcash_qr_url: '',
    gotyme_qr_url: ''
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/promo-codes');
      if (response.ok) {
        const data = await response.json();
        setPromoCodes(data);
      }
    } catch (error) {
      console.error('Failed to fetch promo codes:', error);
      showMessage('error', 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  const createPromoCode = async () => {
    try {
      // Only send code field if it's provided
      const payload: any = { ...newPromo };
      if (!payload.code) {
        delete payload.code; // Don't send empty code
      }

      const response = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        showMessage('success', 'Promo code created successfully!');
        setShowCreateModal(false);
        setNewPromo({
          code: '',
          discount_percent: 10,
          applicable_plans: ['monthly'],
          usage_limit: 100,
          expires_at: '',
          campaign_name: '',
          notes: '',
          gcash_qr_url: '',
          gotyme_qr_url: ''
        });
        fetchPromoCodes();
      } else {
        throw new Error('Create failed');
      }
    } catch (error) {
      console.error('Create error:', error);
      showMessage('error', 'Failed to create promo code');
    }
  };

  const uploadQrCode = async (promoCodeId: number, method: 'gcash' | 'gotyme', file: File) => {
    try {
      setUploading(true);

      // Upload to Pinata
      const formData = new FormData();
      formData.append('file', file);
      formData.append('method', method);

      const uploadResponse = await fetch('/api/admin/upload-qr-code', {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();

        // Update promo code with QR URL
        const updateResponse = await fetch(`/api/admin/promo-codes/${promoCodeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [`${method}_qr_url`]: uploadData.url
          }),
        });

        if (updateResponse.ok) {
          showMessage('success', `QR code uploaded for ${method.toUpperCase()}!`);
          fetchPromoCodes();
        } else {
          throw new Error('Update failed');
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showMessage('error', `Failed to upload QR code for ${method.toUpperCase()}`);
    } finally {
      setUploading(false);
    }
  };

  const deactivatePromoCode = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showMessage('success', 'Promo code deactivated');
        fetchPromoCodes();
      } else {
        throw new Error('Deactivate failed');
      }
    } catch (error) {
      console.error('Deactivate error:', error);
      showMessage('error', 'Failed to deactivate promo code');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin text-4xl mr-3">⏳</div>
        <p className="text-gray-600">Loading promo codes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Promo Code Management</h2>
          <p className="text-gray-600">Create and manage promo codes with QR codes</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          + Create Promo Code
        </button>
      </div>

      {/* Promo Codes List */}
      <div className="grid gap-6">
        {promoCodes.map((promo) => (
          <div key={promo.id} className="bg-white rounded-lg border p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{promo.code}</h3>
                <p className="text-sm text-gray-600">
                  {promo.discount_percent}% discount on {promo.applicable_plans.join(', ')} plans
                </p>
              </div>
              <div className="text-right">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  promo.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {promo.is_active ? 'Active' : 'Inactive'}
                </div>
                {promo.expires_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Expires: {new Date(promo.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Usage Stats */}
            {promo.usage_limit && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-900">Usage</span>
                  <span className="text-sm text-blue-700">
                    {promo.current_usage || 0} / {promo.usage_limit}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{
                      width: `${Math.min(((promo.current_usage || 0) / promo.usage_limit) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* QR Code Upload */}
            <div className="grid md:grid-cols-2 gap-4">
              {['gcash', 'gotyme'].map((method) => (
                <div key={method} className="border rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {method.toUpperCase()} QR Code
                  </label>

                  {promo[`${method}_qr_url` as keyof typeof promo] && (
                    <div className="relative w-24 h-24 border rounded-lg overflow-hidden mb-2">
                      <img
                        src={promo[`${method}_qr_url` as keyof typeof promo] as string}
                        alt={`${method} QR`}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-1 right-1 bg-green-500 text-white text-xs px-1 rounded">
                        ✓
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadQrCode(promo.id, method as 'gcash' | 'gotyme', file);
                    }}
                    disabled={uploading}
                    className="hidden"
                    id={`qr-upload-${promo.id}-${method}`}
                  />
                  <label
                    htmlFor={`qr-upload-${promo.id}-${method}`}
                    className={`block text-center px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                      uploading
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {uploading ? 'Uploading...' : 'Upload QR'}
                  </label>
                </div>
              ))}
            </div>

            {/* Campaign Info */}
            {promo.campaign_name && (
              <div className="text-sm">
                <span className="font-medium">Campaign:</span> {promo.campaign_name}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              {promo.is_active && (
                <button
                  onClick={() => deactivatePromoCode(promo.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Promo Code</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Promo Code (optional)</label>
                <input
                  type="text"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Leave empty to auto-generate"
                  pattern="[A-Z0-9]+"
                  maxLength={20}
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for auto-generated code, or enter your own (6-20 characters, letters and numbers only)</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Discount Percent</label>
                <input
                  type="number"
                  value={newPromo.discount_percent}
                  onChange={(e) => setNewPromo({ ...newPromo, discount_percent: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="1"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Applicable Plans</label>
                <div className="grid grid-cols-3 gap-2">
                  {['monthly', 'quarterly', 'annual'].map((plan) => (
                    <label key={plan} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newPromo.applicable_plans.includes(plan)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewPromo({
                              ...newPromo,
                              applicable_plans: [...newPromo.applicable_plans, plan]
                            });
                          } else {
                            setNewPromo({
                              ...newPromo,
                              applicable_plans: newPromo.applicable_plans.filter(p => p !== plan)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="capitalize">{plan}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Usage Limit</label>
                <input
                  type="number"
                  value={newPromo.usage_limit}
                  onChange={(e) => setNewPromo({ ...newPromo, usage_limit: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min="1"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for one-time use codes</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Expiration Date</label>
                <input
                  type="datetime-local"
                  value={newPromo.expires_at}
                  onChange={(e) => setNewPromo({ ...newPromo, expires_at: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={newPromo.campaign_name}
                  onChange={(e) => setNewPromo({ ...newPromo, campaign_name: e.target.value })}
                  placeholder="Summer Sale 2024"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes</label>
                <textarea
                  value={newPromo.notes}
                  onChange={(e) => setNewPromo({ ...newPromo, notes: e.target.value })}
                  placeholder="Internal notes about this promo..."
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={createPromoCode}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Create Promo Code
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPromo({
                      code: '',
                      discount_percent: 10,
                      applicable_plans: ['monthly'],
                      usage_limit: 100,
                      expires_at: '',
                      campaign_name: '',
                      notes: '',
                      gcash_qr_url: '',
                      gotyme_qr_url: ''
                    });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}