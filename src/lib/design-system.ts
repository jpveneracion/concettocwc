// Shared design-system utilities for the Concetto dashboard.
// See DESIGN-TRANSFORMATION-SPEC.md for the full system definition.

const statusBadgeClasses: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  trialing: 'bg-sky-50 text-sky-700 border-sky-100',
  past_due: 'bg-rose-50 text-rose-700 border-rose-100',
  cancelled: 'bg-slate-50 text-slate-600 border-slate-200',
  suspended: 'bg-amber-50 text-amber-700 border-amber-100',
  delivered: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  draft: 'bg-slate-50 text-slate-600 border-slate-200',
  sent: 'bg-sky-50 text-sky-700 border-sky-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  rejected: 'bg-rose-50 text-rose-700 border-rose-100',
  refunded: 'bg-slate-50 text-slate-600 border-slate-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  processing: 'bg-sky-50 text-sky-700 border-sky-100',
  failed: 'bg-rose-50 text-rose-700 border-rose-100',
};

export function getStatusBadgeClass(status: string): string {
  return statusBadgeClasses[status] || 'bg-slate-50 text-slate-600 border-slate-200';
}

export function getStatusBadgeClassName(status: string): string {
  return `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border ${getStatusBadgeClass(
    status
  )}`;
}

export function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export const cardClasses =
  'bg-white border border-stone-200 rounded-xl card-shadow transition-all duration-200';

export const sectionHeadingClasses =
  'text-base md:text-lg font-semibold text-stone-900 tracking-tight mb-4';