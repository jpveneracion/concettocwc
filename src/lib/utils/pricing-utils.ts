/**
 * Utility functions for pricing-related UI calculations and formatting
 */

/**
 * Get CSS classes for change type badges
 * @param changeType - The type of change (create, update, expire, reactivate)
 * @returns CSS class string for the badge styling
 */
export function getChangeTypeBadgeClass(changeType: string): string {
  switch (changeType) {
    case 'create':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'update':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'expire':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'reactivate':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Get CSS classes for change type backgrounds and borders
 * @param changeType - The type of change (create, update, expire, reactivate)
 * @returns Object containing background and border class strings
 */
export function getChangeTypeCardStyles(changeType: string): { bg: string; border: string } {
  switch (changeType) {
    case 'create':
      return { bg: 'bg-green-50', border: 'border-green-200' };
    case 'update':
      return { bg: 'bg-blue-50', border: 'border-blue-200' };
    case 'expire':
      return { bg: 'bg-red-50', border: 'border-red-200' };
    case 'reactivate':
      return { bg: 'bg-yellow-50', border: 'border-yellow-200' };
    default:
      return { bg: 'bg-gray-50', border: 'border-gray-200' };
  }
}

/**
 * Get CSS classes for timeline dots
 * @param changeType - The type of change (create, update, expire, reactivate)
 * @returns CSS class string for the timeline dot styling
 */
export function getTimelineDotClass(changeType: string): string {
  switch (changeType) {
    case 'create':
      return 'bg-green-500 border-green-200';
    case 'update':
      return 'bg-blue-500 border-blue-200';
    case 'expire':
      return 'bg-red-500 border-red-200';
    case 'reactivate':
      return 'bg-yellow-500 border-yellow-200';
    default:
      return 'bg-gray-500 border-gray-200';
  }
}

/**
 * Format timestamp into human-readable relative time
 * @param date - The date to format
 * @returns Formatted string like "5 minutes ago", "2 hours ago", etc.
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const timestamp = new Date(date);
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Format price for display
 * @param price - The price value to format
 * @returns Formatted price string
 */
export function formatPrice(price: number): string {
  return `PHP ${price.toFixed(2)}`;
}

/**
 * Calculate percentage discount multiplier
 * @param discountPercent - The discount percentage
 * @returns Multiplier to apply to base price (e.g., 0.85 for 15% discount)
 */
export function getDiscountMultiplier(discountPercent: number): number {
  return 1 - discountPercent / 100;
}