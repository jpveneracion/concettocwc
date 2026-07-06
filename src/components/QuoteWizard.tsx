'use client';
import { useState, createContext, useContext } from 'react';

interface QuoteWizardProps {
  children: React.ReactNode;
  onComplete: () => void;
}

type WizardStep = 'customer' | 'measurements' | 'products' | 'review';

interface WizardContextType {
  currentStep: WizardStep;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  isStepValid: (step: WizardStep) => boolean;
  setStepValid: (step: WizardStep, valid: boolean) => void;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within QuoteWizard');
  }
  return context;
}

export default function QuoteWizard({ children, onComplete }: QuoteWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('customer');
  const [stepValidity, setStepValidity] = useState<Record<WizardStep, boolean>>({
    customer: false,
    measurements: false,
    products: false,
    review: false,
  });

  const steps: Array<{ key: WizardStep; label: string; number: number }> = [
    { key: 'customer', label: 'Customer', number: 1 },
    { key: 'measurements', label: 'Measurements', number: 2 },
    { key: 'products', label: 'Products', number: 3 },
    { key: 'review', label: 'Review', number: 4 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const goToStep = (step: WizardStep) => {
    const stepIndex = steps.findIndex(s => s.key === step);
    // Only allow going back or to next valid step
    if (stepIndex <= currentStepIndex || stepValidity[step]) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].key);
    } else {
      onComplete();
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].key);
    }
  };

  const isStepValid = (step: WizardStep) => stepValidity[step];

  const setStepValid = (step: WizardStep, valid: boolean) => {
    setStepValidity(prev => ({ ...prev, [step]: valid }));
  };

  return (
    <WizardContext.Provider value={{ currentStep, goToStep, nextStep, previousStep, isStepValid, setStepValid }}>
      <div className="w-full">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4" role="navigation" aria-label="Wizard progress">
            {steps.map((step) => {
              const isCompleted = step.number < currentStepIndex + 1;
              const isCurrent = step.key === currentStep;
              const isDisabled = step.number > currentStepIndex + 1;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <button
                    onClick={() => goToStep(step.key)}
                    disabled={isDisabled}
                    aria-label={`Go to ${step.label} step`}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-disabled={isDisabled}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-400'
                    } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {step.number}
                  </button>
                  {step.number < steps.length && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        step.number < currentStepIndex + 1 ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
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
            onClick={previousStep}
            disabled={currentStepIndex === 0}
            aria-label="Go to previous step"
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={nextStep}
            aria-label={currentStepIndex === steps.length - 1 ? 'Submit quote' : 'Go to next step'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {currentStepIndex === steps.length - 1 ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </WizardContext.Provider>
  );
}