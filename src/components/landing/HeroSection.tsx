'use client';

import React, { useState } from 'react';
import { ArrowRight, FileText, ShieldCheck, TrendingUp, Clock } from 'lucide-react';
import type { HeroSectionProps } from '@/types/landing';
import LoginModal from './LoginModal';

export default function HeroSection({
  headline,
  subheadline,
  primaryCtaText,
  primaryCtaLink,
  secondaryCtaText,
  secondaryCtaLink
}: HeroSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePrimaryCtaClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsModalOpen(true);
  };

  return (
    <section className="relative bg-gradient-to-br from-emerald-50 via-white to-indigo-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-stone-900 mb-6 tracking-tight">
            {headline}
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl lg:text-2xl text-stone-700 mb-8 max-w-3xl mx-auto">
            {subheadline}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handlePrimaryCtaClick}
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl text-center"
            >
              {primaryCtaText}
            </button>
            <a
              href={secondaryCtaLink}
              onClick={(e) => handleSmoothScroll(e, secondaryCtaLink)}
              className="w-full sm:w-auto px-8 py-4 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-stone-50 transition-colors shadow-md hover:shadow-lg text-center flex items-center justify-center gap-2"
            >
              {secondaryCtaText}
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>

          {/* Trust Badges */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Secure & encrypted data
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Trusted by growing businesses
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">
              <Clock className="w-5 h-5 text-emerald-600" />
              Instant document generation
            </div>
          </div>

          {/* Visual Element */}
          <div className="mt-12 flex justify-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md">
              <div className="flex items-center justify-center gap-4">
                <FileText className="w-12 h-12 text-stone-400" />
                <ArrowRight className="w-8 h-8 text-indigo-600" />
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center shadow-md">
                  <span className="text-white font-bold">DC</span>
                </div>
              </div>
              <p className="text-center text-stone-600 mt-4 text-sm">
                From paper to digital
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </section>
  );
}