import { AdminLayout } from "@/components/AdminLayout";
import AdvancedPaymentSettings from "@/components/admin/AdvancedPaymentSettings";
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function PaymentSettingsPage() {
  // Server-side admin authentication check
  const session = await getSession();
  if (!session || !session.isAdmin) {
    redirect('/login');
  }

  return (
    <AdminLayout title="Payment Settings">
      <AdvancedPaymentSettings />
    </AdminLayout>
  );
}