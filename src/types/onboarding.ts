export type OnboardingIcon = string;

export interface OnboardingStep {
  id: string;
  title: string;
  content: string[];
  tips?: string[];
  icon: OnboardingIcon;
  actionLabel?: string;
  actionLink?: string;
}

export type PrimaryColor = 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'yellow' | 'pink' | 'gray';

export interface FeatureOnboardingContent {
  featureId: string;
  featureName: string;
  description: string;
  steps: OnboardingStep[];
  primaryColor?: PrimaryColor;
}

export interface UserProgress {
  completedFeatures: string[];
  skippedFeatures: string[];
  lastViewed: string;
}

// Route Configuration Types
export interface RoutePattern {
  pattern: string;
  matchType: 'exact' | 'startsWith' | 'regex';
  priority?: number;
}

export interface RouteOnboardingConfig {
  route: string;
  featureId: string;
  enabled: boolean;
  priority: number;
  pattern?: RoutePattern;
}

// User Tracking Types
export interface RouteVisit {
  route: string;
  firstVisit: string;
  visitCount: number;
  lastVisit: string;
}

export interface UserOnboardingState {
  completedRoutes: string[];
  skippedRoutes: string[];
  routeVisits: RouteVisit[];
  lastUpdated: string;
}

export interface OnboardingStatistics {
  completed: number;
  skipped: number;
  pending: number;
  total: number;
  visited: number;
}

// Utility Types
export type RouteMatcher = (currentPath: string) => string | null;
export type OnboardingChecker = (route: string, userId?: string) => boolean;
export type RouteVisitor = (route: string, userId?: string) => void;
export type OnboardingMarker = (route: string, userId?: string) => void;

export interface ColorClasses {
  bg: string;
  bgHover: string;
  indicator: string;
  border: string;
  tipsBg: string;
  tipsBorder: string;
  tipsIcon: string;
  tipsText: string;
  tipsContent: string;
}

export const getColorClasses = (primaryColor: PrimaryColor): ColorClasses => {
  const colorMap: Record<PrimaryColor, ColorClasses> = {
    green: {
      bg: 'bg-green-600',
      bgHover: 'hover:bg-green-700',
      indicator: 'bg-green-600',
      border: 'border-green-200',
      tipsBg: 'bg-green-50',
      tipsBorder: 'border-green-100',
      tipsIcon: 'text-green-600',
      tipsText: 'text-green-900',
      tipsContent: 'text-green-800'
    },
    blue: {
      bg: 'bg-indigo-600',
      bgHover: 'hover:bg-indigo-700',
      indicator: 'bg-indigo-600',
      border: 'border-indigo-200',
      tipsBg: 'bg-indigo-50',
      tipsBorder: 'border-indigo-100',
      tipsIcon: 'text-indigo-600',
      tipsText: 'text-indigo-900',
      tipsContent: 'text-indigo-800'
    },
    purple: {
      bg: 'bg-indigo-600',
      bgHover: 'hover:bg-indigo-700',
      indicator: 'bg-indigo-600',
      border: 'border-indigo-200',
      tipsBg: 'bg-indigo-50',
      tipsBorder: 'border-indigo-100',
      tipsIcon: 'text-indigo-600',
      tipsText: 'text-indigo-900',
      tipsContent: 'text-indigo-800'
    },
    red: {
      bg: 'bg-red-600',
      bgHover: 'hover:bg-red-700',
      indicator: 'bg-red-600',
      border: 'border-red-200',
      tipsBg: 'bg-red-50',
      tipsBorder: 'border-red-100',
      tipsIcon: 'text-red-600',
      tipsText: 'text-red-900',
      tipsContent: 'text-red-800'
    },
    orange: {
      bg: 'bg-orange-600',
      bgHover: 'hover:bg-orange-700',
      indicator: 'bg-orange-600',
      border: 'border-orange-200',
      tipsBg: 'bg-orange-50',
      tipsBorder: 'border-orange-100',
      tipsIcon: 'text-orange-600',
      tipsText: 'text-orange-900',
      tipsContent: 'text-orange-800'
    },
    yellow: {
      bg: 'bg-yellow-600',
      bgHover: 'hover:bg-yellow-700',
      indicator: 'bg-yellow-600',
      border: 'border-yellow-200',
      tipsBg: 'bg-yellow-50',
      tipsBorder: 'border-yellow-100',
      tipsIcon: 'text-yellow-600',
      tipsText: 'text-yellow-900',
      tipsContent: 'text-yellow-800'
    },
    pink: {
      bg: 'bg-pink-600',
      bgHover: 'hover:bg-pink-700',
      indicator: 'bg-pink-600',
      border: 'border-pink-200',
      tipsBg: 'bg-pink-50',
      tipsBorder: 'border-pink-100',
      tipsIcon: 'text-pink-600',
      tipsText: 'text-pink-900',
      tipsContent: 'text-pink-800'
    },
    gray: {
      bg: 'bg-stone-600',
      bgHover: 'hover:bg-stone-700',
      indicator: 'bg-stone-600',
      border: 'border-stone-200',
      tipsBg: 'bg-stone-50',
      tipsBorder: 'border-stone-100',
      tipsIcon: 'text-stone-600',
      tipsText: 'text-stone-900',
      tipsContent: 'text-stone-800'
    }
  };

  return colorMap[primaryColor];
};