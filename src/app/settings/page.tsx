'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';

type CompanyForm = {
  name: string;
  address: string;
  mobile: string;
  email: string;
  currency: string;
  prepared_by: string;
  terms: string;
  del_note: string;
  closing_note: string;
};

export default function SettingsPage() {
  const [form, setForm] = useState<Partial<CompanyForm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => { setForm(s); setLoading(false); });
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
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
          <button
            onClick={handleSave}
            disabled={saving}
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
