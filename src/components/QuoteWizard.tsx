'use client';
import { useState, createContext, useContext, ReactNode } from 'react';

interface QuoteWizardProps {
  children: ReactNode;
  onComplete: (data: Record<string, any>) => void;
}

type WizardStep = 'customer' | 'measurements' | 'products' | 'review';

interface StepConfig {
  key: WizardStep;
  label: string;
  number: number;
  content: ReactNode;
  validation?: () => boolean;
}

interface WizardContextType {
  currentStep: WizardStep;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  setStepData: (step: WizardStep, data: any) => void;
  getStepData: (step: WizardStep) => any;
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
  const [stepData, setStepDataState] = useState<Record<WizardStep, any>>({
    customer: null,
    measurements: null,
    products: null,
    review: null,
  });

  const [stepConfigs, setStepConfigs] = useState<StepConfig[]>([]);

  const registerStep = (step: WizardStep, content: ReactNode, validation?: () => boolean) => {
    setStepConfigs(prev => {
      const existing = prev.findIndex(s => s.key === step);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { key: step, label: getStepLabel(step), number: existing + 1, content, validation };
        return updated;
      }
      return [...prev, { key: step, label: getStepLabel(step), number: prev.length + 1, content, validation }];
    });
  };

  const getStepLabel = (step: WizardStep): string => {
    const labels: Record<WizardStep, string> = {
      customer: 'Customer',
      measurements: 'Measurements',
      products: 'Products',
      review: 'Review'
    };
    return labels[step];
  };

  const currentStepIndex = stepConfigs.findIndex(s => s.key === currentStep);
  const currentConfig = stepConfigs[currentStepIndex];

  const setStepData = (step: WizardStep, data: any) => {
    setStepDataState(prev => ({ ...prev, [step]: data }));
  };

  const getStepData = (step: WizardStep) => stepData[step];

  const goToStep = (step: WizardStep) => {
    const stepIndex = stepConfigs.findIndex(s => s.key === step);
    // Allow going back or to next valid step
    if (stepIndex <= currentStepIndex || (stepIndex >= 0 && stepConfigs[stepIndex]?.validation?.())) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentConfig?.validation && !currentConfig.validation()) {
      return; // Don't proceed if current step is invalid
    }

    if (currentStepIndex < stepConfigs.length - 1 && currentStepIndex >= 0) {
      setCurrentStep(stepConfigs[currentStepIndex + 1].key);
    } else {
      onComplete(stepData);
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(stepConfigs[currentStepIndex - 1].key);
    }
  };

  return (
    <WizardContext.Provider value={{ currentStep, goToStep, nextStep, previousStep, setStepData, getStepData }}>
      <div className="w-full">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4" role="navigation" aria-label="Wizard progress">
            {stepConfigs.length > 0 ? stepConfigs.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = step.key === currentStep;
              const isDisabled = index > currentStepIndex;

              return (
                <div key={step.key} className="flex items-center flex-1">
                  <button
                    onClick={() => goToStep(step.key)}
                    disabled={isDisabled}
                    aria-label={`Go to ${step.label} step`}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-400'
                    } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {index + 1}
                  </button>
                  {index < stepConfigs.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            }) : (
              <div className="text-gray-400 text-sm">Loading wizard...</div>
            )}
          </div>
          {stepConfigs.length > 0 && (
            <div className="hidden md:flex justify-between text-sm text-gray-600">
              {stepConfigs.map((step) => (
                <div key={step.key} className={`flex-1 text-center ${
                  step.key === currentStep ? 'font-medium text-blue-600' : ''
                }`}>
                  {step.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wizard content - render current step */}
        <div className="mb-6">
          {currentConfig?.content || <div className="text-gray-400">Step content not loaded</div>}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t border-gray-200">
          <button
            onClick={previousStep}
            disabled={currentStepIndex <= 0}
            aria-label="Go to previous step"
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={nextStep}
            aria-label={currentStepIndex >= stepConfigs.length - 1 ? 'Submit quote' : 'Go to next step'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {currentStepIndex >= stepConfigs.length - 1 ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </WizardContext.Provider>
  );
}