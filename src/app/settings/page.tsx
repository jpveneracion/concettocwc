'use client';
import { useEffect, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';

type CompanyForm = {
  code: string;
  name: string;
  address: string;
  mobile: string;
  email: string;
  currency: string;
  prepared_by: string;
  terms: string;
  del_note: string;
  closing_note: string;
  minimum_area_sqft: number;
};

type CodeStatus = 'idle' | 'checking' | 'available' | 'taken';

export default function SettingsPage() {
  const [form, setForm] = useState<Partial<CompanyForm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [codeStatus, setCodeStatus] = useState<CodeStatus>('idle');
  const originalCodeRef = useRef('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => {
        setForm(s);
        originalCodeRef.current = (s.code ?? '').toString().trim().toUpperCase();
        setLoading(false);
      });
  }, []);

  // Debounced async availability check for the company code
  useEffect(() => {
    const code = (form.code ?? '').trim().toUpperCase();
    if (!code || code === originalCodeRef.current) {
      setCodeStatus('idle');
      return;
    }
    setCodeStatus('checking');
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/company-code-available?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        setCodeStatus(res.ok && data.available ? 'available' : 'taken');
      } catch {
        setCodeStatus('idle');
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [form.code]);

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaveError(data.error === 'Company code already exists' ? 'Company code is already taken.' : 'Failed to save settings.');
      setSaving(false);
      return;
    }
    originalCodeRef.current = (form.code ?? '').trim().toUpperCase();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const field = (label: string, key: keyof CompanyForm, placeholder = '') => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        value={(form[key] as string) ?? ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  );

  const textarea = (label: string, key: keyof CompanyForm) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
        value={(form[key] as string) ?? ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  if (loading) return <AppLayout><div className="p-8 text-gray-400">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
        <h1 className="text-lg md:text-xl font-semibold">Settings</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">✓ Saved!</span>}
          {saveError && <span className="text-sm text-red-500">{saveError}</span>}
          <button
            onClick={handleSave}
            disabled={saving || codeStatus === 'taken'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl space-y-4 md:space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="font-medium text-sm text-gray-700">Appearance</h3>
              <p className="text-xs text-gray-500 mt-1">Customize your theme, mode, and colors</p>
            </div>
            <a
              href="/settings/appearance"
              className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-center md:text-left"
            >
              Manage Appearance →
            </a>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="font-medium text-sm text-gray-700">Product Pricing</h3>
              <p className="text-xs text-gray-500 mt-1">Set pricing for each blinds family (collection)</p>
            </div>
            <a
              href="/settings/pricing"
              className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-center md:text-left"
            >
              Manage Pricing →
            </a>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
          <h3 className="font-medium text-sm text-gray-700 mb-4">Company info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {field('Company name', 'name', 'CONCETTO WINDOW COVERINGS')}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Company code</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase"
                value={(form.code as string) ?? ''}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="YOURCODE"
              />
              {codeStatus === 'checking' && <p className="text-xs text-gray-400 mt-1">Checking availability...</p>}
              {codeStatus === 'available' && <p className="text-xs text-green-600 mt-1">✓ Code is available</p>}
              {codeStatus === 'taken' && <p className="text-xs text-red-500 mt-1">✗ This code is already taken</p>}
            </div>
            {field('Mobile', 'mobile', '0935-880 1914 / 0928-638 5433')}
            {field('Email', 'email', 'concettowindowcoverings@gmail.com')}
            <div className="md:col-span-2">
              {field('Address', 'address', '107 Cruz na Daan, San Rafael, Bulacan 3008')}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Currency</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={(form.currency as string) ?? 'PHP'}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="USD">USD - US Dollar ($)</option>
                <option value="EUR">EUR - Euro (€)</option>
                <option value="GBP">GBP - British Pound (£)</option>
                <option value="JPY">JPY - Japanese Yen (¥)</option>
                <option value="AUD">AUD - Australian Dollar (A$)</option>
                <option value="CAD">CAD - Canadian Dollar (C$)</option>
                <option value="PHP">PHP - Philippine Peso (₱)</option>
                <option value="SGD">SGD - Singapore Dollar (S$)</option>
                <option value="HKD">HKD - Hong Kong Dollar (HK$)</option>
                <option value="CNY">CNY - Chinese Yuan (¥)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Minimum area (sq.ft.)</label>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={(form.minimum_area_sqft as number) ?? 15}
                onChange={(e) => setForm({ ...form, minimum_area_sqft: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-400 mt-1">Smallest billable area per window (0 disables)</p>
            </div>
            {field('Prepared by', 'prepared_by', 'John Paul Veneracion')}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
          <h3 className="font-medium text-sm text-gray-700 mb-4">Document text</h3>
          <div className="space-y-3">
            {textarea('Terms', 'terms')}
            {textarea('DEL note', 'del_note')}
            {textarea('Closing note', 'closing_note')}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
