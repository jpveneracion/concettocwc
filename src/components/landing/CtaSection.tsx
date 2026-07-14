'use client';

import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { CtaSectionProps } from '@/types/landing';

const defaultCtaProps: CtaSectionProps = {
  headline: 'Ready to Transform Your Blinds Business?',
  subtext: 'Join manufacturers and retailers who\'ve modernized their quotation workflow',
  primaryCtaText: 'Start Your Free Trial',
  primaryCtaLink: '/signup',
  secondaryCtaText: 'Learn More About Features',
  secondaryCtaLink: '#features',
  benefits: [
    'No credit card required for trial',
    'OAuth authentication for secure setup',
    'Mobile-first design for on-the-go access',
    'Instant company setup and dashboard access'
  ]
};

export default function CtaSection(props: Partial<CtaSectionProps> = {}) {
  const {
    headline,
    subtext,
    primaryCtaText,
    primaryCtaLink,
    secondaryCtaText,
    secondaryCtaLink,
    benefits
  } = { ...defaultCtaProps, ...props };

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-600 to-blue-700">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
          {headline}
        </h2>

        <p className="text-lg sm:text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
          {subtext}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <a
            href={primaryCtaLink}
            className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl text-center"
          >
            {primaryCtaText}
          </a>
          <a
            href={secondaryCtaLink}
            onClick={(e) => handleSmoothScroll(e, secondaryCtaLink)}
            className="w-full sm:w-auto px-8 py-4 bg-transparent text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors border-2 border-white text-center flex items-center justify-center gap-2"
          >
            {secondaryCtaText}
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>

        {/* Benefits List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {benefits.map((benefit, index) => (
            <div 
              key={index} 
              className="flex items-center gap-3 text-white text-left"
            >
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm sm:text-base">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
