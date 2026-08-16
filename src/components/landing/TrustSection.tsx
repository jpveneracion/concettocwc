'use client';

import React from 'react';
import { Gift, CloudLightning, Headphones, Star, LucideIcon } from 'lucide-react';
import type { TrustSignalProps } from '@/types/landing';

const trustSignals: TrustSignalProps[] = [
  {
    icon: 'setup',
    title: 'Quick Setup',
    description: 'Get started fast with streamlined onboarding'
  },
  {
    icon: 'support',
    title: 'Ongoing Support',
    description: 'Dedicated support and guidance when you need it'
  },
  {
    icon: 'gift',
    title: 'Flexible Plans',
    description: 'Choose the plan that works best for your business'
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
        <h2 className="text-3xl sm:text-4xl font-bold text-stone-900 text-center mb-4">
          Join Modern Businesses Transforming Their Operations
        </h2>

        {/* Rating */}
        <div className="flex items-center justify-center gap-1.5 mb-12">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
            ))}
          </div>
          <span className="text-sm text-stone-600 ml-2">Rated 5.0 by business owners</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {trustSignals.map((signal, index) => {
            const Icon = iconMap[signal.icon];
            return (
              <div
                key={index}
                className="text-center bg-stone-50 rounded-xl p-8 border border-stone-200 hover:border-indigo-300 hover:shadow-lg transition-all"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Icon className="w-10 h-10 text-emerald-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-stone-900 mb-3">
                  {signal.title}
                </h3>
                <p className="text-stone-600">
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
