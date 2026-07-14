'use client';

import React from 'react';
import { Gift, Lightning, Headphones } from 'lucide-react';
import type { TrustSignalProps } from '@/types/landing';

const trustSignals: TrustSignalProps[] = [
  {
    icon: 'gift',
    title: 'Free Trial Available',
    description: 'Start with a free trial - no credit card required'
  },
  {
    icon: 'setup',
    title: 'Easy Setup',
    description: 'Quick company setup with OAuth authentication'
  },
  {
    icon: 'support',
    title: 'Mobile Support',
    description: 'Mobile-optimized support and onboarding guidance'
  }
];

const iconMap = {
  'gift': Gift,
  'setup': Lightning,
  'support': Headphones
};

export default function TrustSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
          Join the Modern Blinds Industry
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {trustSignals.map((signal, index) => {
            const Icon = iconMap[signal.icon as keyof typeof iconMap];
            return (
              <div 
                key={index} 
                className="text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
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
