'use client';
import { useState, createContext, useContext } from 'react';

interface QuoteWizardProps {
  quoteNumber: string;
  existingData?: any;
  onComplete: (data: Record<string, unknown>) => void;
}

type WizardStep = 'customer' | 'measurements' | 'review';

interface WizardContextType {
  currentStep: WizardStep;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  previousStep: () => void;
  setStepData: (step: WizardStep, data: unknown) => void;
  getStepData: (step: WizardStep) => unknown;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within QuoteWizard');
  }
  return context;
}

// Import step components
import CustomerStep from './wizard/CustomerStep';
import MeasurementsStep from './wizard/MeasurementsStep';
import ReviewStep from './wizard/ReviewStep';

const STEP_COMPONENTS: Record<WizardStep, React.ComponentType<any>> = {
  customer: CustomerStep,
  measurements: MeasurementsStep,
  review: ReviewStep,
};

const STEP_LABELS: Record<WizardStep, string> = {
  customer: 'Customer',
  measurements: 'Measurements & Products',
  review: 'Review & Pricing',
};

const STEP_ORDER: WizardStep[] = ['customer', 'measurements', 'review'];

export default function QuoteWizard({ quoteNumber, existingData, onComplete }: QuoteWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('customer');
  const [stepData, setStepDataState] = useState<Record<WizardStep, unknown>>({
    customer: null,
    measurements: null,
    review: null,
  });

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const CurrentStepComponent = STEP_COMPONENTS[currentStep];

  const setStepData = (step: WizardStep, data: unknown) => {
    setStepDataState((prev) => ({ ...prev, [step]: data }));
  };

  const getStepData = (step: WizardStep) => stepData[step];

  const validateCurrentStep = (): boolean => {
    // Try to call the step's validation function if it exists
    const validationFn = (window as any)[`__${currentStep}StepValidation`];
    if (typeof validationFn === 'function') {
      return validationFn();
    }
    return true; // Default to valid if no validation function
  };

  const goToStep = (step: WizardStep) => {
    const stepIndex = STEP_ORDER.indexOf(step);
    // Allow going back or to next valid step
    if (stepIndex <= currentStepIndex) {
      setCurrentStep(step);
    } else if (validateCurrentStep()) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (!validateCurrentStep()) {
      return; // Don't proceed if current step is invalid
    }

    if (currentStepIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentStepIndex + 1]);
    } else {
      // Submit the quote
      onComplete(stepData);
    }
  };

  const previousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(STEP_ORDER[currentStepIndex - 1]);
    }
  };

  // Get step-specific props
  const getStepProps = (): any => {
    switch (currentStep) {
      case 'customer':
        return {
          quoteNumber,
          existingData: existingData ? {
            customer_name: existingData.customer_name,
            customer_address: existingData.customer_address,
            quote_date: existingData.quote_date,
            our_ref: existingData.our_ref,
            status: existingData.status,
          } : undefined,
        };
      case 'measurements':
        return {
          existingData: stepData.measurements as any,
        };
      case 'review':
        return {
          existingData: stepData.review as any,
        };
      default:
        return {};
    }
  };

  return (
    <WizardContext.Provider value={{ currentStep, goToStep, nextStep, previousStep, setStepData, getStepData }}>
      <div className="w-full">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4" role="navigation" aria-label="Wizard progress">
            {STEP_ORDER.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = step === currentStep;
              const isDisabled = index > currentStepIndex;

              return (
                <div key={step} className="flex items-center flex-1">
                  <button
                    onClick={() => goToStep(step)}
                    disabled={isDisabled}
                    aria-label={`Go to ${STEP_LABELS[step]} step`}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-400'
                    } ${isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue-200'}`}
                  >
                    {index + 1}
                  </button>
                  {index < STEP_ORDER.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="hidden md:flex justify-between text-sm text-gray-600">
            {STEP_ORDER.map((step) => (
              <div key={step} className={`flex-1 text-center ${
                step === currentStep ? 'font-medium text-blue-600' : ''
              }`}>
                {STEP_LABELS[step]}
              </div>
            ))}
          </div>
        </div>

        {/* Wizard content - render current step */}
        <div className="mb-6">
          {CurrentStepComponent ? (
            <CurrentStepComponent {...getStepProps()} />
          ) : (
            <div className="text-gray-400">Step component not loaded</div>
          )}
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
            aria-label={currentStepIndex >= STEP_ORDER.length - 1 ? 'Submit quote' : 'Go to next step'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            {currentStepIndex >= STEP_ORDER.length - 1 ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </WizardContext.Provider>
  );
}