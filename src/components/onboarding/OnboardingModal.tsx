'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Lightbulb, Sparkles } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  content: string[];
  tips?: string[];
  icon: string;
  actionLabel?: string;
  actionLink?: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Concetto! 🎉',
    content: [
      'You\'re about to transform how you manage your blinds business. Concetto makes it easy to create quotes, track orders, and grow your business.',
      'This quick tour will show you the essential features you\'ll use every day. It only takes a few minutes, and you can skip anytime.'
    ],
    tips: [
      '💡 This tour works on any device - phone, tablet, or computer',
      '⏱️ Takes about 3 minutes to complete all sections'
    ],
    icon: '👋'
  },
  {
    id: 'quotes',
    title: 'Create Professional Quotes',
    content: [
      'Our step-by-step wizard guides you through creating quotes - from customer details to product selection and pricing.',
      'No more manual calculations or complicated spreadsheets. Just enter the info and let the system do the work.'
    ],
    tips: [
      '📋 Quotes save automatically as you work',
      '📱 Create quotes on-site using your mobile device'
    ],
    icon: '📝',
    actionLabel: 'Try Creating a Quote',
    actionLink: '/quotes/new'
  },
  {
    id: 'dashboard',
    title: 'Track Your Business Success',
    content: [
      'See your sales, quotes, and profits at a glance. Your dashboard shows what\'s working and what needs attention.',
      'Track trends over time and spot opportunities to grow your business.'
    ],
    tips: [
      '📊 Check your dashboard daily for quick insights',
      '📈 Use trends to plan inventory and marketing'
    ],
    icon: '📊',
    actionLabel: 'Visit Your Dashboard',
    actionLink: '/dashboard'
  },
  {
    id: 'products',
    title: 'Browse & Select Products',
    content: [
      'Explore our catalog of blinds and window treatments. Each product includes specifications, pricing, and availability.',
      'Create company-specific products with custom pricing for your unique offerings.'
    ],
    tips: [
      '🔍 Search and filter to find the right products quickly',
      '🏷️ Product codes make quote creation fast and accurate'
    ],
    icon: '🏷️',
    actionLabel: 'Browse Products',
    actionLink: '/products'
  },
  {
    id: 'settings',
    title: 'Make It Yours',
    content: [
      'Customize your business information, terms, and communication preferences.',
      'Your details appear on quotes and documents - keep them updated for a professional touch.'
    ],
    tips: [
      '⚙️ Set up once, use everywhere - updates apply automatically',
      '🏢 Your company branding appears on all documents'
    ],
    icon: '⚙️',
    actionLabel: 'Configure Settings',
    actionLink: '/settings'
  },
  {
    id: 'get-started',
    title: 'You\'re Ready to Go! 🚀',
    content: [
      'You\'ve learned the essentials - now it\'s time to put Concetto to work for your business.',
      'Start with creating your first quote, or explore your dashboard to see what\'s possible.'
    ],
    tips: [
      '🎯 Focus on one feature at a time - quotes are a great starting point',
      '❓ Need help? Each section has its own detailed guide'
    ],
    icon: '✨',
    actionLabel: 'Start Creating Quotes',
    actionLink: '/quotes/new'
  }
];

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const completedOnboarding = localStorage.getItem('concetto_onboarding_completed');
    if (completedOnboarding) {
      setIsCompleted(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    localStorage.setItem('concetto_onboarding_completed', 'true');
    setIsCompleted(true);
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  const step = onboardingSteps[currentStep];

  if (!isOpen || isCompleted) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative border-2 border-indigo-200">
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close onboarding"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Step Indicator */}
        <div className="flex justify-center mb-4 sm:mb-6">
          {onboardingSteps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 sm:h-2 rounded-full mx-0.5 sm:mx-1 transition-all duration-300 ${
                index === currentStep
                  ? 'w-6 sm:w-8 bg-indigo-600'
                  : index < currentStep
                  ? 'w-1.5 sm:w-2 bg-green-500'
                  : 'w-1.5 sm:w-2 bg-gray-300'
              }`}
              aria-label={`Step ${index + 1} of ${onboardingSteps.length}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center mb-4 sm:mb-6">
          {/* Icon */}
          <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">{step.icon}</div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 px-2">
            {step.title}
          </h2>

          {/* Content Points */}
          <div className="text-left space-y-2 sm:space-y-3 px-2 mb-4">
            {step.content.map((point, index) => (
              <p key={index} className="text-sm sm:text-base text-gray-700 leading-relaxed">
                {point}
              </p>
            ))}
          </div>

          {/* Tips Section */}
          {step.tips && step.tips.length > 0 && (
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-indigo-50 rounded-lg border border-indigo-100">
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-indigo-900">Pro Tips</span>
              </div>
              <ul className="space-y-1.5 text-left">
                {step.tips.map((tip, index) => (
                  <li key={index} className="text-xs sm:text-sm text-indigo-800 leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="text-center text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
          Step {currentStep + 1} of {onboardingSteps.length}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base order-3 sm:order-1"
          >
            Skip Tour
          </button>

          {/* Previous Button (hidden on first step) */}
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base flex items-center justify-center gap-2 order-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>
          )}

          {/* Action/Next Button */}
          {step.actionLink && step.actionLabel ? (
            <button
              onClick={() => {
                handleComplete();
                window.location.href = step.actionLink || '';
              }}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base flex items-center justify-center gap-2 order-1 sm:order-3"
            >
              {step.actionLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm sm:text-base flex items-center justify-center gap-2 order-1 sm:order-3"
            >
              {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
