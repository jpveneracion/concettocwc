// src/app/admin/promo-codes/page.tsx
import { AdminLayout } from "@/components/AdminLayout";
import PromoCodeManager from "@/components/admin/PromoCodeManager";
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function PromoCodesPage() {
  // Server-side admin authentication check
  const session = await getSession();
  if (!session || !session.isAdmin) {
    redirect('/login');
  }

  return (
    <AdminLayout title="Promo Codes">
      <PromoCodeManager />
    </AdminLayout>
  );
}
