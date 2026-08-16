'use client';

import React, { useState } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import type { NavigationProps } from '@/types/landing';
import LoginModal from './LoginModal';

const defaultNavProps: NavigationProps = {
  logoText: 'Concetto',
  links: [
    { text: 'Features', href: '#features' },
    { text: 'How It Works', href: '#solution' }
  ],
  ctaText: 'Start Trial',
  ctaLink: '/signup'
};

export default function Navigation(props: Partial<NavigationProps> = {}) {
  const { logoText, links, ctaText, ctaLink } = { ...defaultNavProps, ...props };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        setMobileMenuOpen(false);
      }
    }
  };

  const handleCtaClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsModalOpen(true);
    setMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="text-xl font-bold text-stone-900 tracking-tight">
                {logoText}
              </span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {links.map((link, index) => (
              <a
                key={index}
                href={link.href}
                onClick={(e) => handleSmoothScroll(e, link.href)}
                className="text-stone-700 hover:text-indigo-600 transition-colors font-medium"
              >
                {link.text}
              </a>
            ))}
            <a
              href="/login"
              className="text-stone-700 hover:text-indigo-600 transition-colors font-medium flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </a>
            <button
              onClick={handleCtaClick}
              className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm hover:shadow-md"
            >
              {ctaText}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-4 text-stone-700 hover:text-indigo-600 focus:outline-none"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-stone-200">
            <div className="flex flex-col space-y-4">
              {links.map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  onClick={(e) => handleSmoothScroll(e, link.href)}
                  className="text-stone-700 hover:text-indigo-600 transition-colors font-medium"
                >
                  {link.text}
                </a>
              ))}
              <a
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-stone-700 hover:text-indigo-600 transition-colors font-medium flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </a>
              <button
                onClick={handleCtaClick}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors text-center w-full"
              >
                {ctaText}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </nav>
  );
}
