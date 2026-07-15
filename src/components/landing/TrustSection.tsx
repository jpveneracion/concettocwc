'use client';

import React from 'react';
import { Gift, CloudLightning, Headphones, LucideIcon } from 'lucide-react';
import type { TrustSignalProps } from '@/types/landing';

const trustSignals: TrustSignalProps[] = [
  {
    icon: 'gift',
    title: 'Risk-Free Trial',
    description: 'Experience the platform before committing'
  },
  {
    icon: 'setup',
    title: 'Quick Setup',
    description: 'Get started fast with streamlined onboarding'
  },
  {
    icon: 'support',
    title: 'Ongoing Support',
    description: 'Dedicated support and guidance when you need it'
  }
];

const iconMap: Record<TrustSignalProps['icon'], LucideIcon> = {
  'gift': Gift,
  'setup': CloudLightning,
  'support': Headphones
};

export default function TrustSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
          Join Modern Businesses Transforming Their Operations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {trustSignals.map((signal, index) => {
            const Icon = iconMap[signal.icon];
            return (
              <div
                key={index}
                className="text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <Icon className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {signal.title}
                </h3>
                <p className="text-gray-600">
                  {signal.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
