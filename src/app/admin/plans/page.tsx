'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { AlertTriangle, CheckCircle2, Settings, X } from 'lucide-react';
import SubscriptionPlanList from '@/components/admin/SubscriptionPlanList';
import SubscriptionPlanForm from '@/components/admin/SubscriptionPlanForm';

interface SubscriptionPlanData {
  id?: string;
  name: string;
  description: string;
  base_monthly_price?: number;
  price: number;
  currency: string;
  interval: 'month' | 'quarter' | 'year';
  discount_percent: number;
  features: string[];
  is_active: boolean;
}

interface SubscriptionPlan extends SubscriptionPlanData {
  id: string;
  base_monthly_price?: number;
  created_at: string;
  updated_at: string;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/plans?include_inactive=true');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch plans');
      }

      setPlans(data.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan(planData: SubscriptionPlanData) {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create plan');
      }

      setSuccessMessage('Plan created successfully!');
      setShowForm(false);
      fetchPlans();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdatePlan(planData: SubscriptionPlanData) {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update plan');
      }

      setSuccessMessage('Plan updated successfully!');
      setShowForm(false);
      setEditingPlan(null);
      fetchPlans();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan');
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePlan(planId: string) {
    try {
      const res = await fetch(`/api/admin/plans?id=${planId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete plan');
      }

      setSuccessMessage('Plan deleted successfully!');
      fetchPlans();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plan');
    }
  }

  async function handleToggleStatus(planId: string, newStatus: boolean) {
    try {
      // Find the plan
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;

      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: planId,
          is_active: newStatus
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update plan status');
      }

      setSuccessMessage(`Plan ${newStatus ? 'activated' : 'deactivated'} successfully!`);
      fetchPlans();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan status');
    }
  }

  function handleEditPlan(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setShowForm(true);
    setError('');
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingPlan(null);
    setError('');
  }

  function handleStartNewPlan() {
    setEditingPlan(null);
    setShowForm(true);
    setError('');
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Subscription Plans Management</h1>
          <p className="text-stone-600 mt-1">
            Create and manage subscription plans for your service
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mr-2" />
              <p className="text-sm text-emerald-800">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-rose-600 mr-2" />
              <p className="text-sm text-rose-800">{error}</p>
              <button
                onClick={() => setError('')}
                className="ml-auto text-rose-600 hover:text-rose-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Action Bar */}
        {!showForm && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-sm text-stone-600">
              {plans.length} {plans.length === 1 ? 'plan' : 'plans'} available
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/admin/payment-settings"
                className="bg-stone-100 text-stone-700 px-6 py-3 rounded-lg font-medium hover:bg-stone-200 min-h-[44px] inline-flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Payment Settings
              </Link>
              <button
                onClick={handleStartNewPlan}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 min-h-[44px]"
              >
                Create New Plan
              </button>
            </div>
          </div>
        )}

        {/* Form View */}
        {showForm && (
          <div className="space-y-4">
            <button
              onClick={handleCancelForm}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              ← Back to Plans List
            </button>
            <SubscriptionPlanForm
              onSubmit={editingPlan ? handleUpdatePlan : handleCreatePlan}
              onCancel={handleCancelForm}
              initialData={editingPlan || undefined}
              isLoading={submitting}
            />
          </div>
        )}

        {/* Plans List View */}
        {!showForm && (
          <SubscriptionPlanList
            plans={plans}
            onEdit={handleEditPlan}
            onDelete={handleDeletePlan}
            onToggleStatus={handleToggleStatus}
            isLoading={loading}
          />
        )}
      </div>
    </AdminLayout>
  );
}