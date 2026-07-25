'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Lightbulb, FileText, Wand2, Users, Zap } from 'lucide-react';
import {
  OnboardingStep,
  FeatureOnboardingContent,
  PrimaryColor,
  getColorClasses
} from '../../types/onboarding';

interface CreateOrdersOnboardingContent extends FeatureOnboardingContent {
  primaryColor: PrimaryColor;
}

const createOrdersOnboardingContent: CreateOrdersOnboardingContent = {
  featureId: 'create-orders',
  featureName: 'Create Orders',
  description: 'Learn how to create professional quotes and orders efficiently',
  primaryColor: 'green',
  steps: [
    {
      id: 'welcome',
      title: 'Creating Quotes Made Simple',
      content: [
        'Creating quotes for your blinds business has never been easier. Choose the approach that works best for you.',
        'Whether you\'re a seasoned pro or new to the business, we have the perfect method to help you create accurate, professional quotes in minutes.'
      ],
      tips: [
        '🎯 Both methods create the same professional quotes - just different workflows',
        '⏱️ Most quotes take less than 5 minutes to complete'
      ],
      icon: '👋'
    },
    {
      id: 'choose-method',
      title: 'Choose Your Approach',
      content: [
        'You have two ways to create quotes - pick the one that matches your experience level and workflow preference.',
        'Switch between methods anytime using the toggle button at the top of the page.'
      ],
      tips: [
        '🔄 Toggle between methods anytime - no need to commit to just one',
        '💡 Start with Wizard Mode if you\'re new, then switch to Traditional Form as you get comfortable'
      ],
      icon: '🔀'
    },
    {
      id: 'traditional-form',
      title: 'Traditional Form - For Experienced Users',
      content: [
        'The Traditional Form puts everything on one page - perfect if you know exactly what you\'re doing.',
        'All customer info, measurements, products, and pricing are visible at once. Just fill in the fields and submit.',
        'Ideal for experienced users who can work quickly without step-by-step guidance.'
      ],
      tips: [
        '⚡ Fastest method once you\'re familiar with the process',
        '👀 See everything at a glance - perfect for quick edits and changes',
        '🎯 Best for users who create quotes daily and know exactly what information they need'
      ],
      icon: '📝'
    },
    {
      id: 'wizard-intro',
      title: 'Wizard Mode - Step-by-Step Guidance',
      content: [
        'Wizard Mode breaks the quote creation into easy, manageable steps - perfect for new users or complex orders.',
        'Each step focuses on one part of the process, so you never feel overwhelmed or unsure what to do next.',
        'Get helpful tips and guidance at each stage to ensure accuracy and professionalism.'
      ],
      tips: [
        '🧙 Perfect for training new team members or less experienced staff',
        '✅ Built-in checks help prevent mistakes and missing information',
        '📱 Works great on mobile devices - focus on one task at a time'
      ],
      icon: '🧙'
    },
    {
      id: 'wizard-step-1',
      title: 'Wizard Step 1: Customer Information',
      content: [
        'Start by entering who you\'re creating the quote for - this personalizes the document and helps with follow-up.',
        'Fill in the customer\'s name, address, and contact details. This information appears on the final quote.',
        'Add today\'s date and optionally a reference number for your own tracking system.'
      ],
      tips: [
        '👤 Use the customer\'s preferred name for a personal touch',
        '📍 Complete addresses help with delivery and installation planning later',
        '📅 The quote date helps customers know when the pricing was provided'
      ],
      icon: '👤'
    },
    {
      id: 'wizard-step-2',
      title: 'Wizard Step 2: Window Measurements',
      content: [
        'Add each window or area where you\'ll install blinds - the system handles all the complicated math automatically.',
        'Enter width and height measurements for each window. The system calculates square footage and pricing instantly.',
        'Choose between inches or centimeters, depending on your preference and customer needs.'
      ],
      tips: [
        '📏 Measure twice for accuracy - even small errors can affect final pricing',
        '🪟 Add location notes like "Master Bedroom" or "Kitchen Window" for easy reference',
        '💡 Take photos during measurement to reference during installation'
      ],
      icon: '📏'
    },
    {
      id: 'wizard-step-3',
      title: 'Wizard Step 3: Product Selection',
      content: [
        'Choose the perfect blinds for each window from your product catalog - pricing updates automatically.',
        'Browse by collection, filter by material or price, and select products that match your customer\'s needs.',
        'The system shows product details, specifications, and availability to help you make the right choice.'
      ],
      tips: [
        '🏷️ Product codes help you find items quickly and ensure accuracy',
        '💰 Compare different options to give customers choices that fit their budget',
        '🎨 Consider both style and function when selecting products for each room'
      ],
      icon: '🏷️'
    },
    {
      id: 'wizard-step-4',
      title: 'Wizard Step 4: Review & Finalize',
      content: [
        'See your complete quote with all details - items, measurements, products, and final pricing.',
        'Review everything carefully before saving or sending to your customer.',
        'Add delivery fees or installation charges, then choose to save as draft or send directly to the customer.'
      ],
      tips: [
        '✅ Double-check all measurements and customer details before sending',
        '💡 The system calculates totals automatically - no math errors',
        '📧 Send quotes directly from the system or download as PDF for email'
      ],
      icon: '✅'
    },
    {
      id: 'get-started',
      title: 'Ready to Create Your First Quote?',
      content: [
        'You now understand both approaches - choose the one that feels right for you today.',
        'Remember: you can always switch methods if your preference changes or for different types of orders.',
        'Start creating professional quotes that will impress your customers and grow your business.'
      ],
      tips: [
        '🎯 Start with Wizard Mode if you\'re new or training staff',
        '⚡ Switch to Traditional Form once you\'re comfortable with the process',
        '🏆 Both methods create the same professional, accurate quotes'
      ],
      icon: '🚀',
      actionLabel: 'Start Creating Quotes',
      actionLink: '/quotes/new'
    }
  ]
};

interface CreateOrdersOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function CreateOrdersOnboardingModal({
  isOpen,
  onClose,
  onComplete
}: CreateOrdersOnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Check if user has completed create orders onboarding
    const completedOnboarding = localStorage.getItem('concetto_onboarding_create-orders_completed');
    if (completedOnboarding) {
      setIsCompleted(true);
    } else {
      setIsCompleted(false);
      setCurrentStep(0);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < createOrdersOnboardingContent.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('concetto_onboarding_create-orders_completed', 'true');
    setIsCompleted(true);

    // Track progress
    const progress = JSON.parse(localStorage.getItem('concetto_onboarding_progress') || '{}');
    progress['create-orders'] = {
      completed: true,
      completedAt: new Date().toISOString()
    };
    localStorage.setItem('concetto_onboarding_progress', JSON.stringify(progress));

    if (onComplete) {
      onComplete();
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    const progress = JSON.parse(localStorage.getItem('concetto_onboarding_progress') || '{}');
    progress['create-orders'] = {
      skipped: true,
      skippedAt: new Date().toISOString()
    };
    localStorage.setItem('concetto_onboarding_progress', JSON.stringify(progress));

    onClose();
  };

  const handleAction = () => {
    const step = createOrdersOnboardingContent.steps[currentStep];
    if (step.actionLink) {
      handleComplete();
      window.location.href = step.actionLink;
    }
  };

  const step = createOrdersOnboardingContent.steps[currentStep];

  if (!isOpen || isCompleted) {
    return null;
  }

  const colorClasses = getColorClasses(createOrdersOnboardingContent.primaryColor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black bg-opacity-50">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative ${colorClasses.border} border-2`}>
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close onboarding"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Feature Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <FileText className="w-4 h-4" />
            <span className="font-medium">{createOrdersOnboardingContent.featureName}</span>
          </div>
          <p className="text-xs text-gray-600">{createOrdersOnboardingContent.description}</p>
        </div>

        {/* Mode Indicators for Choose Method Step */}
        {currentStep === 2 && (
          <div className="flex gap-2 mb-4">
            <div className="flex-1 p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <div className="text-2xl mb-1">📝</div>
              <div className="text-xs font-semibold text-blue-900">Traditional Form</div>
              <div className="text-xs text-blue-700">Experienced Users</div>
            </div>
            <div className="flex-1 p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
              <div className="text-2xl mb-1">🧙</div>
              <div className="text-xs font-semibold text-purple-900">Wizard Mode</div>
              <div className="text-xs text-purple-700">Step-by-Step Guide</div>
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex justify-center mb-4 sm:mb-6">
          {createOrdersOnboardingContent.steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 sm:h-2 rounded-full mx-0.5 sm:mx-1 transition-all duration-300 ${
                index === currentStep
                  ? 'w-6 sm:w-8 ' + colorClasses.indicator
                  : index < currentStep
                  ? 'w-1.5 sm:w-2 bg-green-500'
                  : 'w-1.5 sm:w-2 bg-gray-300'
              }`}
              aria-label={`Step ${index + 1} of ${createOrdersOnboardingContent.steps.length}`}
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
            <div className={`mt-4 sm:mt-6 p-3 sm:p-4 ${colorClasses.tipsBg} rounded-lg border ${colorClasses.tipsBorder}`}>
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb className={`w-4 h-4 ${colorClasses.tipsIcon} mt-0.5 flex-shrink-0`} />
                <span className={`text-xs sm:text-sm font-semibold ${colorClasses.tipsText}`}>Pro Tips</span>
              </div>
              <ul className="space-y-1.5 text-left">
                {step.tips.map((tip, index) => (
                  <li key={index} className={`text-xs sm:text-sm ${colorClasses.tipsContent} leading-relaxed`}>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="text-center text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
          Step {currentStep + 1} of {createOrdersOnboardingContent.steps.length}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base order-3 sm:order-1"
          >
            Skip
          </button>

          {/* Previous Button (hidden on first step) */}
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              className="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base flex items-center justify-center gap-2 order-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>
          )}

          {/* Action/Next Button */}
          {step.actionLink && step.actionLabel ? (
            <button
              onClick={handleAction}
              className={`${colorClasses.bg} ${colorClasses.bgHover} text-white rounded-lg transition-colors text-sm sm:text-base px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-center gap-2 order-1 sm:order-3`}
            >
              {step.actionLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              className={`${colorClasses.bg} ${colorClasses.bgHover} text-white rounded-lg transition-colors text-sm sm:text-base px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-center gap-2 order-1 sm:order-3`}
            >
              {currentStep === createOrdersOnboardingContent.steps.length - 1 ? 'Complete' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}