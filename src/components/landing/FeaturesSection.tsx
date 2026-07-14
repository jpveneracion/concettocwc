'use client';

import React from 'react';
import { 
  FileText, 
  BarChart3, 
  Package, 
  Shield, 
  Smartphone, 
  Settings 
} from 'lucide-react';
import type { FeatureCardProps } from '@/types/landing';

const features: FeatureCardProps[] = [
  {
    icon: 'quote-wizard',
    title: 'Quote Wizard',
    description: 'Guided quotation workflow with customer info, measurements, and pricing',
    benefit: 'Faster quote creation with fewer errors'
  },
  {
    icon: 'dashboard',
    title: 'Dashboard Analytics',
    description: 'Real-time metrics, trends, and business insights',
    benefit: 'Data-driven business decisions'
  },
  {
    icon: 'catalog',
    title: 'Product Catalog',
    description: 'Company-specific products with global promotion workflow',
    benefit: 'Organized product management'
  },
  {
    icon: 'security',
    title: 'Multi-tenant Security',
    description: 'Per-company data vaults with PII encryption',
    benefit: 'Secure data isolation'
  },
  {
    icon: 'mobile',
    title: 'Mobile-First Design',
    description: 'Work from anywhere with responsive mobile optimization',
    benefit: 'On-the-go business management'
  },
  {
    icon: 'admin',
    title: 'Admin Tools',
    description: 'Revenue tracking, activation codes, and user management',
    benefit: 'Complete business control'
  }
];

const iconMap = {
  'quote-wizard': FileText,
  'dashboard': BarChart3,
  'catalog': Package,
  'security': Shield,
  'mobile': Smartphone,
  'admin': Settings
};

export default function FeaturesSection() {
  return (
    <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
          Powerful Features for Modern Blinds Businesses
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon as keyof typeof iconMap];
            return (
              <div 
                key={index} 
                className="group bg-gray-50 rounded-xl p-6 border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                    <Icon className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      {feature.description}
                    </p>
                    <div className="text-xs font-medium text-indigo-600">
                      ✓ {feature.benefit}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
