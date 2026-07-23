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
  crypto: {
    usdc: {
      polygonAddress: string;
      enabled: boolean;
    };
    usdt: {
      tronAddress: string;
      enabled: boolean;
    };
  };
  business: {
    name: string;
    supportEmail: string;
    verificationTime: string;
  };
}

export default function PaymentSettingsManager() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ method: string; progress: number } | null>(null);
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

  const handleUploadQrCode = async (method: 'gcash' | 'gotyme', file: File) => {
    try {
      setUploading(true);
      setUploadProgress({ method, progress: 0 });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('method', method);

      // Upload to Pinata
      const uploadResponse = await fetch('/api/admin/upload-qr-code', {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        setUploadProgress({ method, progress: 100 });

        // Update local settings
        if (settings && settings.mobile[method]) {
          const updatedSettings = {
            ...settings,
            mobile: {
              ...settings.mobile,
              [method]: {
                ...settings.mobile[method],
                qrCodeUrl: uploadData.url
              }
            }
          };
          setSettings(updatedSettings);

          // Auto-save to database
          await saveSettings(updatedSettings);
          showMessage('success', `QR code uploaded for ${method.toUpperCase()}!`);
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showMessage('error', `Failed to upload QR code for ${method.toUpperCase()}`);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const saveSettings = async (settingsToSave: PaymentSettings | null = settings) => {
    try {
      setSaving(true);

      if (!settingsToSave) {
        throw new Error('No settings to save');
      }

      const response = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave),
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

      {/* Payment Methods */}
      <div className="grid md:grid-cols-2 gap-6">
        {['gcash', 'gotyme'].map((method) => (
          <div key={method} className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="text-lg font-semibold capitalize">{method} Settings</h3>

            {/* QR Code Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QR Code Image
              </label>
              <div className="space-y-3">
                {settings.mobile[method as 'gcash' | 'gotyme'].qrCodeUrl && (
                  <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                    <img
                      src={settings.mobile[method as 'gcash' | 'gotyme'].qrCodeUrl}
                      alt={`${method} QR Code`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1 rounded">
                      ✓
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadQrCode(method as 'gcash' | 'gotyme', file);
                    }}
                    disabled={uploading}
                    className="hidden"
                    id={`qr-upload-${method}`}
                  />
                  <label
                    htmlFor={`qr-upload-${method}`}
                    className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                      uploading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {uploading && uploadProgress?.method === method
                      ? `Uploading... ${uploadProgress.progress}%`
                      : 'Upload New QR Code'}
                  </label>
                </div>

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
                  placeholder="Or paste Pinata URL here..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Account Details */}
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
                placeholder="0917-123-4567"
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
                placeholder="Concetto Inc."
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

      {/* Business Info */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h3 className="text-lg font-semibold">Business Information</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Business Name
            </label>
            <input
              type="text"
              value={settings.business.name}
              onChange={(e) => {
                const updatedSettings = {
                  ...settings,
                  business: {
                    ...settings.business,
                    name: e.target.value
                  }
                };
                setSettings(updatedSettings);
              }}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Support Email
            </label>
            <input
              type="email"
              value={settings.business.supportEmail}
              onChange={(e) => {
                const updatedSettings = {
                  ...settings,
                  business: {
                    ...settings.business,
                    supportEmail: e.target.value
                  }
                };
                setSettings(updatedSettings);
              }}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => saveSettings()}
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