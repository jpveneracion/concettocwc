'use client';

import { useState, useEffect } from 'react';

interface PaymentSettings {
  mobile: {
    gcash: {
      number: string;
      accountName: string;
      qrCodeUrl: string;
      enabled: boolean;
    };
    gotyme: {
      number: string;
      accountName: string;
      qrCodeUrl: string;
      enabled: boolean;
    };
  };
  planQrCodes: {
    gcash_basic?: string;
    gcash_pro?: string;
    gcash_premium?: string;
    gotyme_basic?: string;
    gotyme_pro?: string;
    gotyme_premium?: string;
  };
  business: {
    name: string;
    supportEmail: string;
    verificationTime: string;
  };
}

export default function AdvancedPaymentSettings() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'payment-methods' | 'plan-qrcodes' | 'promo-qrcodes'>('payment-methods');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/payment-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      showMessage('error', 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadQrCode = async (field: string, file: File) => {
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('method', field.split('_')[0]); // Extract gcash/gotyme from field name

      const uploadResponse = await fetch('/api/admin/upload-qr-code', {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();

        // Update the specific field
        if (settings) {
          const updatedSettings = {
            ...settings,
            planQrCodes: {
              ...settings.planQrCodes,
              [field]: uploadData.url
            }
          };
          setSettings(updatedSettings);

          // Auto-save to database
          await savePlanQrCodes(updatedSettings.planQrCodes);
          showMessage('success', `QR code uploaded for ${field.replace('_', ' ')}!`);
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showMessage('error', 'Failed to upload QR code');
    } finally {
      setUploading(false);
    }
  };

  const savePlanQrCodes = async (planQrCodes: { [key: string]: string | undefined }) => {
    try {
      const response = await fetch('/api/admin/qr-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'plan',
          ...planQrCodes
        }),
      });

      if (!response.ok) throw new Error('Save failed');
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        showMessage('success', 'Payment settings saved successfully!');
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      showMessage('error', 'Failed to save payment settings');
    } finally {
      setSaving(false);
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
        <p className="text-gray-600">Loading payment settings...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Failed to load payment settings</p>
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

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex space-x-8">
          {[
            { id: 'payment-methods', label: 'Payment Methods' },
            { id: 'plan-qrcodes', label: 'Plan-Specific QR Codes' },
            { id: 'promo-qrcodes', label: 'Promo QR Codes' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'payment-methods' && (
        <div className="grid md:grid-cols-2 gap-6">
          {['gcash', 'gotyme'].map((method) => (
            <div key={method} className="bg-white rounded-lg border p-6 space-y-4">
              <h3 className="text-lg font-semibold capitalize">{method} Settings</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Generic QR Code (fallback)
                </label>
                <input
                  type="text"
                  value={settings.mobile[method as 'gcash' | 'gotyme'].qrCodeUrl}
                  onChange={(e) => {
                    const updatedSettings = {
                      ...settings,
                      mobile: {
                        ...settings.mobile,
                        [method]: {
                          ...settings.mobile[method as 'gcash' | 'gotyme'],
                          qrCodeUrl: e.target.value
                        }
                      }
                    };
                    setSettings(updatedSettings);
                  }}
                  placeholder="Paste Pinata URL..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={settings.mobile[method as 'gcash' | 'gotyme'].number}
                  onChange={(e) => {
                    const updatedSettings = {
                      ...settings,
                      mobile: {
                        ...settings.mobile,
                        [method]: {
                          ...settings.mobile[method as 'gcash' | 'gotyme'],
                          number: e.target.value
                        }
                      }
                    };
                    setSettings(updatedSettings);
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  value={settings.mobile[method as 'gcash' | 'gotyme'].accountName}
                  onChange={(e) => {
                    const updatedSettings = {
                      ...settings,
                      mobile: {
                        ...settings.mobile,
                        [method]: {
                          ...settings.mobile[method as 'gcash' | 'gotyme'],
                          accountName: e.target.value
                        }
                      }
                    };
                    setSettings(updatedSettings);
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.mobile[method as 'gcash' | 'gotyme'].enabled}
                  onChange={(e) => {
                    const updatedSettings = {
                      ...settings,
                      mobile: {
                        ...settings.mobile,
                        [method]: {
                          ...settings.mobile[method as 'gcash' | 'gotyme'],
                          enabled: e.target.checked
                        }
                      }
                    };
                    setSettings(updatedSettings);
                  }}
                  className="rounded"
                />
                <label className="text-sm font-medium">Enabled</label>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'plan-qrcodes' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Plan-Specific QR Codes</h4>
            <p className="text-sm text-blue-700">
              Upload fixed-amount QR codes for each plan tier. These will be used automatically based on the customer's chosen plan.
            </p>
          </div>

          {['gcash', 'gotyme'].map((method) => (
            <div key={method} className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold capitalize mb-4">{method} Plan QR Codes</h3>

              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { tier: 'basic', price: '~₱499', field: `${method}_basic` },
                  { tier: 'pro', price: '~₱999', field: `${method}_pro` },
                  { tier: 'premium', price: '~₱1,999+', field: `${method}_premium` }
                ].map((plan) => (
                  <div key={plan.field} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1)} ({plan.price})
                      </label>

                      {settings.planQrCodes?.[plan.field as keyof typeof settings.planQrCodes] && (
                        <div className="relative w-24 h-24 border rounded-lg overflow-hidden mb-2">
                          <img
                            src={settings.planQrCodes[plan.field as keyof typeof settings.planQrCodes] as string}
                            alt={`${method} ${plan.tier} QR`}
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
                          if (file) handleUploadQrCode(plan.field, file);
                        }}
                        disabled={uploading}
                        className="hidden"
                        id={`qr-upload-${plan.field}`}
                      />
                      <label
                        htmlFor={`qr-upload-${plan.field}`}
                        className={`block text-center px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                          uploading
                            ? 'bg-gray-100 text-gray-400'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {uploading ? 'Uploading...' : 'Upload QR'}
                      </label>

                      <input
                        type="text"
                        value={settings.planQrCodes?.[plan.field as keyof typeof settings.planQrCodes] || ''}
                        onChange={(e) => {
                          const updatedSettings = {
                            ...settings,
                            planQrCodes: {
                              ...settings.planQrCodes,
                              [plan.field]: e.target.value
                            }
                          };
                          setSettings(updatedSettings);
                        }}
                        placeholder="Or paste URL..."
                        className="w-full px-3 py-2 border rounded-lg text-sm mt-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'promo-qrcodes' && (
        <div className="bg-white rounded-lg border p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">Promo QR Codes</h4>
            <p className="text-sm text-blue-700">
              Promo codes with fixed-amount QR codes are managed through the promo code system.
              These QR codes automatically apply discounts and expire based on usage limits.
            </p>
          </div>

          <div className="text-center py-8 text-gray-500">
            <p>Promo QR codes are managed per-promo-code.</p>
            <p className="text-sm mt-2">Use the promo code management interface to set up promo-specific QR codes.</p>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={saveSettings}
          disabled={saving || uploading}
          className={`px-6 py-3 rounded-lg font-medium ${
            saving || uploading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Payment Settings'}
        </button>
      </div>
    </div>
  );
}