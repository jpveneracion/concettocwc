'use client';

import React from 'react';
import { Code, Shield, Globe, Zap } from 'lucide-react';
import type { TechnicalCardProps } from '@/types/landing';

const technicalHighlights: TechnicalCardProps[] = [
  {
    icon: 'tech-stack',
    title: 'Modern Tech Stack',
    description: 'Next.js 16, React 19, and TypeScript for reliability'
  },
  {
    icon: 'security',
    title: 'Secure by Design',
    description: 'OAuth authentication and encrypted PII data storage'
  },
  {
    icon: 'global',
    title: 'Global Ready',
    description: 'UTC standardization for international timezone support'
  },
  {
    icon: 'scalable',
    title: 'Scalable Architecture',
    description: 'Multi-tenant system that grows with your business'
  }
];

const iconMap = {
  'tech-stack': Code,
  'security': Shield,
  'global': Globe,
  'scalable': Zap
};

export default function TechnicalSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
          Built for Business, Designed for Growth
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {technicalHighlights.map((tech, index) => {
            const Icon = iconMap[tech.icon as keyof typeof iconMap];
            return (
              <div 
                key={index} 
                className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border border-gray-200"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <Icon className="w-7 h-7 text-blue-600" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                  {tech.title}
                </h3>
                <p className="text-gray-600 text-sm text-center">
                  {tech.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
