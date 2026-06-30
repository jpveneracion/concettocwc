'use client';
import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import type { Settings } from '@/types';

export default function SettingsPage() {
  const [form, setForm] = useState<Partial<Settings>>({});
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

  const field = (label: string, key: keyof Settings, placeholder = '') => (
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

  const textarea = (label: string, key: keyof Settings) => (
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">✓ Saved!</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : '💾 Save settings'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-medium text-sm text-gray-700 mb-4">Company info</h3>
          <div className="space-y-3">
            {field('Company name', 'company', 'CONCETTO')}
            {field('Address', 'address', '107 Cruz na Daan, San Rafael, Bulacan 3008')}
            {field('Mobile', 'mobile', '0935-880 1914 / 0928-638 5433')}
            {field('Email', 'email', 'concettowindowcoverings@gmail.com')}
            {field('Prepared by', 'prepared_by', 'John Paul Veneracion')}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
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
