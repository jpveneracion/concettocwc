'use client';

import React from 'react';
import { Smartphone, Wand2, FileCheck, FileText, LucideIcon } from 'lucide-react';
import type { SolutionFeatureProps } from '@/types/landing';

const solutionFeatures: SolutionFeatureProps[] = [
  {
    icon: 'smartphone',
    title: 'Digital Collection',
    description: 'Mobile-optimized data collection with automated calculations'
  },
  {
    icon: 'wizard',
    title: 'Smart Document Creation',
    description: 'Streamlined document creation with real-time pricing'
  },
  {
    icon: 'invoice-check',
    title: 'Automated Processing',
    description: 'Generate professional documents instantly from approved inputs'
  }
];

const iconMap: Record<SolutionFeatureProps['icon'], LucideIcon> = {
  smartphone: Smartphone,
  wizard: Wand2,
  'invoice-check': FileCheck
};

export default function SolutionSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-4">
          Meet Concetto: Your Digital Business Platform
        </h2>

        <p className="text-lg sm:text-xl text-gray-700 text-center mb-12 max-w-3xl mx-auto">
          Transform your business processes with modern digital automation and streamlined workflows
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {solutionFeatures.map((feature, index) => {
            const Icon = iconMap[feature.icon];
            return (
              <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Icon className="w-8 h-8 text-indigo-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-center">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Transformation Visual */}
        <div className="mt-12 flex justify-center items-center gap-4">
          <div className="text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-600 mt-2">Manual</p>
          </div>
          <div className="text-2xl text-indigo-600">→</div>
          <div className="text-center">
            <Smartphone className="w-12 h-12 text-indigo-600 mx-auto" />
            <p className="text-sm text-gray-600 mt-2">Digital</p>
          </div>
        </div>
      </div>
    </section>
  );
}
