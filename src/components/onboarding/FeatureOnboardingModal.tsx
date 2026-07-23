'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Lightbulb, Home } from 'lucide-react';
import { FeatureOnboardingContent, OnboardingStep } from '@/types/onboarding';

interface FeatureOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: FeatureOnboardingContent;
  onComplete?: () => void;
}

export default function FeatureOnboardingModal({
  isOpen,
  onClose,
  content,
  onComplete
}: FeatureOnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Check if user has completed this specific feature onboarding
    const completedKey = `concetto_onboarding_${content.featureId}_completed`;
    const completedOnboarding = localStorage.getItem(completedKey);
    if (completedOnboarding) {
      setIsCompleted(true);
    } else {
      setIsCompleted(false);
      setCurrentStep(0);
    }
  }, [content.featureId]);

  const handleNext = () => {
    if (currentStep < content.steps.length - 1) {
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
    const completedKey = `concetto_onboarding_${content.featureId}_completed`;
    localStorage.setItem(completedKey, 'true');
    setIsCompleted(true);

    // Track progress
    const progress = JSON.parse(localStorage.getItem('concetto_onboarding_progress') || '{}');
    progress[content.featureId] = {
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
    progress[content.featureId] = {
      skipped: true,
      skippedAt: new Date().toISOString()
    };
    localStorage.setItem('concetto_onboarding_progress', JSON.stringify(progress));

    onClose();
  };

  const handleAction = () => {
    const step = content.steps[currentStep];
    if (step.actionLink) {
      handleComplete();
      window.location.href = step.actionLink;
    }
  };

  const step = content.steps[currentStep];

  if (!isOpen || isCompleted) {
    return null;
  }

  const colorClasses = {
    blue: {
      bg: 'bg-blue-600',
      bgHover: 'hover:bg-blue-700',
      indicator: 'bg-blue-600',
      border: 'border-blue-200'
    },
    green: {
      bg: 'bg-green-600',
      bgHover: 'hover:bg-green-700',
      indicator: 'bg-green-600',
      border: 'border-green-200'
    },
    purple: {
      bg: 'bg-purple-600',
      bgHover: 'hover:bg-purple-700',
      indicator: 'bg-purple-600',
      border: 'border-purple-200'
    },
    gray: {
      bg: 'bg-gray-600',
      bgHover: 'hover:bg-gray-700',
      indicator: 'bg-gray-600',
      border: 'border-gray-200'
    }
  };

  const colors = colorClasses[content.primaryColor as keyof typeof colorClasses] || colorClasses.blue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black bg-opacity-50">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 relative ${colors.border} border-2`}>
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
            <Home className="w-4 h-4" />
            <span className="font-medium">{content.featureName}</span>
          </div>
          <p className="text-xs text-gray-600">{content.description}</p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center mb-4 sm:mb-6">
          {content.steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 sm:h-2 rounded-full mx-0.5 sm:mx-1 transition-all duration-300 ${
                index === currentStep
                  ? 'w-6 sm:w-8 ' + colors.indicator
                  : index < currentStep
                  ? 'w-1.5 sm:w-2 bg-green-500'
                  : 'w-1.5 sm:w-2 bg-gray-300'
              }`}
              aria-label={`Step ${index + 1} of ${content.steps.length}`}
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
            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-start gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-blue-900">Pro Tips</span>
              </div>
              <ul className="space-y-1.5 text-left">
                {step.tips.map((tip, index) => (
                  <li key={index} className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="text-center text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
          Step {currentStep + 1} of {content.steps.length}
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
              className={`${colors.bg} ${colors.bgHover} text-white rounded-lg transition-colors text-sm sm:text-base px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-center gap-2 order-1 sm:order-3`}
            >
              {step.actionLabel}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              className={`${colors.bg} ${colors.bgHover} text-white rounded-lg transition-colors text-sm sm:text-base px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-center gap-2 order-1 sm:order-3`}
            >
              {currentStep === content.steps.length - 1 ? 'Complete' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}