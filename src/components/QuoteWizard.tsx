'use client';
import { useState } from 'react';

interface QuoteWizardProps {
  children: React.ReactNode;
  onComplete: () => void;
}

type WizardStep = 'customer' | 'measurements' | 'products' | 'review';

export default function QuoteWizard({ children, onComplete }: QuoteWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('customer');
  const [stepData, setStepData] = useState<Record<WizardStep, any>>({
    customer: null,
    measurements: null,
    products: null,
    review: null,
  });

  const steps: Array<{ key: WizardStep; label: string; number: number }> = [
    { key: 'customer', label: 'Customer', number: 1 },
    { key: 'measurements', label: 'Measurements', number: 2 },
    { key: 'products', label: 'Products', number: 3 },
    { key: 'review', label: 'Review', number: 4 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  function handleNext() {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].key);
    } else {
      onComplete();
    }
  }

  function handlePrevious() {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].key);
    }
  }

  function handleStepChange(step: WizardStep) {
    setCurrentStep(step);
  }

  return (
    <div className="w-full">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step) => (
            <div key={step.key} className="flex items-center flex-1">
              <button
                onClick={() => handleStepChange(step.key)}
                disabled={step.number > currentStepIndex + 1}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step.key === currentStep
                    ? 'bg-blue-600 text-white'
                    : step.number < currentStepIndex + 1
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {step.number}
              </button>
              {step.number < steps.length && (
                <div className={`flex-1 h-1 mx-2 ${
                  step.number < currentStepIndex + 1 ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="hidden md:flex justify-between text-sm text-gray-600">
          {steps.map((step) => (
            <div key={step.key} className={`flex-1 text-center ${
              step.key === currentStep ? 'font-medium text-blue-600' : ''
            }`}>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {/* Wizard content */}
      <div className="mb-6">
        {children}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        <button
          onClick={handlePrevious}
          disabled={currentStepIndex === 0}
          className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {currentStepIndex === steps.length - 1 ? 'Submit' : 'Next'}
        </button>
      </div>
    </div>
  );
}
