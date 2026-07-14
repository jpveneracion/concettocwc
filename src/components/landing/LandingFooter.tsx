'use client';

import React from 'react';
import type { FooterProps } from '@/types/landing';

const defaultFooterProps: FooterProps = {
  companyName: 'Concetto Window Coverings',
  links: [
    { text: 'Terms of Service', href: '/terms' },
    { text: 'Privacy Policy', href: '/privacy' },
    { text: 'Contact', href: '/contact' }
  ],
  techStack: 'Built with Next.js, React, TypeScript',
  year: new Date().getFullYear()
};

export default function LandingFooter(props: FooterProps = defaultFooterProps) {
  const { companyName, links, techStack, year } = props;

  return (
    <footer className="bg-gray-900 text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">
              {companyName}
            </h3>
            <p className="text-gray-400 text-sm">
              Modern quotation and ordering platform for window blinds professionals.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2">
              {links.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    {link.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech Stack */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">
              Technology
            </h4>
            <p className="text-gray-400 text-sm">
              {techStack}
            </p>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © {year} {companyName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
