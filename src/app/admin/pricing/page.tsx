// src/app/admin/pricing/page.tsx
// Retired - pricing management now lives in /admin/plans

import { redirect } from 'next/navigation';

export default function AdminPricingPage() {
  redirect('/admin/plans');
}
