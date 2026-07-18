'use client';

import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';

type PaymentMethod = 'gcash' | 'gotyme' | 'usdc' | 'usdt';

interface PaymentSettings {
  mobile: {
    gcash: {
      number: string;
      accountName: string;
      qrCodeUrl?: string;
      enabled: boolean;
    };
    gotyme: {
      number: string;
      accountName: string;
      qrCodeUrl?: string;
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
  rates: {
    phpToUsd: number;
  };
  business: {
    name: string;
    supportEmail: string;
    verificationTime: string;
  };
}

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'mobile' | 'crypto' | 'rates' | 'business'>('mobile');
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
      console.error('Failed to fetch payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Payment settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save payment settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save payment settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      if (!prev) return prev;

      const updated = { ...prev };
      const keys = path.split('.');
      let current: any = updated;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading payment settings...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!settings) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Failed to load payment settings</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Settings</h1>
          <p className="text-gray-500 text-sm">
            Configure payment methods, wallet addresses, and business information
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-sm font-medium ${
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {message.text}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-8">
            {[
              { id: 'mobile', label: 'Mobile Payments' },
              { id: 'crypto', label: 'Crypto Payments' },
              { id: 'rates', label: 'Conversion Rates' },
              { id: 'business', label: 'Business Info' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-4 px-1 text-sm font-medium border-b-2 transition-colors ${
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

        {/* Content */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          {activeTab === 'mobile' && (
            <MobilePaymentSettings settings={settings} updateSetting={updateSetting} />
          )}
          {activeTab === 'crypto' && (
            <CryptoPaymentSettings settings={settings} updateSetting={updateSetting} />
          )}
          {activeTab === 'rates' && (
            <ConversionRateSettings settings={settings} updateSetting={updateSetting} />
          )}
          {activeTab === 'business' && (
            <BusinessSettings settings={settings} updateSetting={updateSetting} />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={fetchSettings}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Reset Changes
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

function MobilePaymentSettings({ settings, updateSetting }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Mobile Payment Methods</h3>

      {/* GCash */}
      <PaymentMethodCard
        title="GCash"
        icon="📱"
        enabled={settings.mobile.gcash.enabled}
        onToggleEnabled={(enabled: boolean) => updateSetting('mobile.gcash.enabled', enabled)}
      >
        <QRCodeUploadSection
          method="gcash"
          number={settings.mobile.gcash.number}
          accountName={settings.mobile.gcash.accountName}
          qrCodeUrl={settings.mobile.gcash.qrCodeUrl}
          onNumberChange={(number: string) => updateSetting('mobile.gcash.number', number)}
          onAccountNameChange={(name: string) => updateSetting('mobile.gcash.accountName', name)}
          onQrCodeUpload={(url: string) => updateSetting('mobile.gcash.qrCodeUrl', url)}
        />
      </PaymentMethodCard>

      {/* GoTyme */}
      <PaymentMethodCard
        title="GoTyme"
        icon="🏦"
        enabled={settings.mobile.gotyme.enabled}
        onToggleEnabled={(enabled: boolean) => updateSetting('mobile.gotyme.enabled', enabled)}
      >
        <QRCodeUploadSection
          method="gotyme"
          number={settings.mobile.gotyme.number}
          accountName={settings.mobile.gotyme.accountName}
          qrCodeUrl={settings.mobile.gotyme.qrCodeUrl}
          onNumberChange={(number: string) => updateSetting('mobile.gotyme.number', number)}
          onAccountNameChange={(name: string) => updateSetting('mobile.gotyme.accountName', name)}
          onQrCodeUpload={(url: string) => updateSetting('mobile.gotyme.qrCodeUrl', url)}
        />
      </PaymentMethodCard>
    </div>
  );
}

function CryptoPaymentSettings({ settings, updateSetting }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Crypto Payment Methods</h3>

      {/* USDC */}
      <PaymentMethodCard
        title="USDC (Polygon)"
        icon="₿"
        enabled={settings.crypto.usdc.enabled}
        onToggleEnabled={(enabled: boolean) => updateSetting('crypto.usdc.enabled', enabled)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Polygon Wallet Address
            </label>
            <input
              type="text"
              value={settings.crypto.usdc.polygonAddress}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('crypto.usdc.polygonAddress', e.target.value)}
              placeholder="0x1234567890123456789012345678901234567890"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Make sure this is a Polygon (MATIC) network address
            </p>
          </div>
        </div>
      </PaymentMethodCard>

      {/* USDT */}
      <PaymentMethodCard
        title="USDT (Tron)"
        icon="₿"
        enabled={settings.crypto.usdt.enabled}
        onToggleEnabled={(enabled: boolean) => updateSetting('crypto.usdt.enabled', enabled)}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tron Wallet Address
            </label>
            <input
              type="text"
              value={settings.crypto.usdt.tronAddress}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('crypto.usdt.tronAddress', e.target.value)}
              placeholder="TXyz123456789012345678901234567890123"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Make sure this is a Tron (TRC20) network address
            </p>
          </div>
        </div>
      </PaymentMethodCard>
    </div>
  );
}

function ConversionRateSettings({ settings, updateSetting }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rates</h3>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-yellow-600 text-xl">⚠️</span>
          <div>
            <p className="font-medium text-yellow-900 mb-1">Rate Accuracy</p>
            <p className="text-sm text-yellow-800">
              These rates are used for crypto payment calculations. Keep them updated for accurate conversions.
              Consider integrating with a rate API for live rates.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PHP to USD Rate
        </label>
        <div className="flex items-center gap-4">
          <input
            type="number"
            step="0.001"
            value={settings.rates.phpToUsd}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('rates.phpToUsd', parseFloat(e.target.value))}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <div className="text-sm text-gray-600">
            1 PHP = ${settings.rates.phpToUsd.toFixed(4)} USD
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Current rate: 1 PHP ≈ ${(1 / settings.rates.phpToUsd).toFixed(2)}
        </p>
      </div>

      <button
        onClick={() => {
          // Placeholder for fetching live rates
          updateSetting('rates.phpToUsd', 0.018);
        }}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
      >
        Update to Live Rate
      </button>
    </div>
  );
}

function BusinessSettings({ settings, updateSetting }: any) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Business Name
        </label>
        <input
          type="text"
          value={settings.business.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('business.name', e.target.value)}
          placeholder="Concetto Inc."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Support Email
        </label>
        <input
          type="email"
          value={settings.business.supportEmail}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('business.supportEmail', e.target.value)}
          placeholder="support@concetto.com"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Verification Time
        </label>
        <input
          type="text"
          value={settings.business.verificationTime}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('business.verificationTime', e.target.value)}
          placeholder="24 hours"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Expected time for payment verification (displayed to customers)
        </p>
      </div>
    </div>
  );
}

function PaymentMethodCard({
  title,
  icon,
  enabled,
  onToggleEnabled,
  children
}: any) {
  return (
    <div className={`border rounded-xl p-6 transition-colors ${
      enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h4 className="font-semibold text-gray-900">{title}</h4>
        </div>
        <button
          onClick={() => onToggleEnabled(!enabled)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            enabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {enabled && (
        <div className="space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function QRCodeUploadSection({
  method,
  number,
  accountName,
  qrCodeUrl,
  onNumberChange,
  onAccountNameChange,
  onQrCodeUpload
}: any) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(qrCodeUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(qrCodeUrl || null);
  }, [qrCodeUrl]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to Pinata
      const formData = new FormData();
      formData.append('file', file);
      formData.append('method', method);

      const response = await fetch('/api/admin/upload-qr-code', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        onQrCodeUpload(data.url);
      } else {
        const error = await response.json();
        alert('Failed to upload QR code: ' + error.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload QR code');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveQrCode = () => {
    setPreview(null);
    onQrCodeUpload('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* QR Code Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          QR Code Image
        </label>

        <div className="flex items-start gap-6">
          {/* Upload Area */}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id={`${method}-qr-upload`}
            />

            <label
              htmlFor={`${method}-qr-upload`}
              className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                uploading
                  ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              {uploading ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Uploading...</p>
                </div>
              ) : (
                <div className="text-center">
                  <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm text-gray-600">
                    <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                </div>
              )}
            </label>
          </div>

          {/* Preview */}
          {preview && (
            <div className="w-32 h-32 border border-gray-200 rounded-lg p-2 bg-white">
              <img
                src={preview}
                alt={`${method.toUpperCase()} QR Code`}
                className="w-full h-full object-contain"
              />
              <button
                onClick={handleRemoveQrCode}
                className="mt-2 w-full px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Upload your official QR code from {method === 'gcash' ? 'GCash' : 'GoTyme'}
        </div>
      </div>

      {/* Account Details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <input
            type="text"
            value={number}
            onChange={(e) => onNumberChange(e.target.value)}
            placeholder="0917-123-4567"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Account Name
          </label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => onAccountNameChange(e.target.value)}
            placeholder="Concetto Inc."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Tip:</strong> Upload your official QR code image from your payment provider.
          Customers will be able to scan it directly to make payments.
        </p>
      </div>
    </div>
  );
}