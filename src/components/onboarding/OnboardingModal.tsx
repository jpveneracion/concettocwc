'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowRight } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Concetto!',
    description: 'Let\'s get your blinds business set up for success. This quick guide will show you the essentials.',
    icon: '👋'
  },
  {
    id: 'quotes',
    title: 'Create Your First Quote',
    description: 'Use our wizard-based system to create professional quotes with customer info, measurements, and pricing.',
    icon: '📋'
  },
  {
    id: 'dashboard',
    title: 'Track Your Business',
    description: 'Monitor your metrics, view trends, and analyze your business performance in real-time.',
    icon: '📊'
  },
  {
    id: 'products',
    title: 'Manage Your Products',
    description: 'Create company-specific products and promote them to the global catalog for wider visibility.',
    icon: '📦'
  },
  {
    id: 'mobile',
    title: 'Work From Anywhere',
    description: 'Access your dashboard, create quotes, and manage your business from any device with our mobile-first design.',
    icon: '📱'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 relative">
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Step Indicator */}
        <div className="flex justify-center mb-6">
          {onboardingSteps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full mx-1 ${
                index === currentStep
                  ? 'w-8 bg-indigo-600'
                  : index < currentStep
                  ? 'w-2 bg-green-500'
                  : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{step.icon}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {step.title}
          </h2>
          <p className="text-gray-600">
            {step.description}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="text-center text-sm text-gray-500 mb-6">
          Step {currentStep + 1} of {onboardingSteps.length}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleSkip}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Skip Tour
          </button>
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
