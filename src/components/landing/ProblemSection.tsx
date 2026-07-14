'use client';

import React from 'react';
import { FileSpreadsheet, FileText, Receipt } from 'lucide-react';
import type { ProblemCardProps } from '@/types/landing';

const problemCards: ProblemCardProps[] = [
  {
    icon: 'spreadsheet',
    title: 'Excel Spreadsheets',
    description: 'Version control issues, calculation errors, and time-consuming data entry'
  },
  {
    icon: 'paper',
    title: 'Paper Measurements',
    description: 'Lost measurement sheets, difficult organization, no backup system'
  },
  {
    icon: 'invoice',
    title: 'Manual Invoicing',
    description: 'Slow processing, payment delays, and manual tracking nightmares'
  }
];

const iconMap = {
  spreadsheet: FileSpreadsheet,
  paper: FileText,
  invoice: Receipt
};

export default function ProblemSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">
          The Challenges of Manual Workflows
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {problemCards.map((card, index) => {
            const Icon = iconMap[card.icon as keyof typeof iconMap];
            return (
              <div key={index} className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:border-red-200 transition-colors">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <Icon className="w-8 h-8 text-red-600" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">
                  {card.title}
                </h3>
                <p className="text-gray-600 text-center">
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
