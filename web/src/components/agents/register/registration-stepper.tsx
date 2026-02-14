'use client';

import { CheckCircle2 } from 'lucide-react';

const steps = [
  { id: 1, label: 'Agent Info' },
  { id: 2, label: 'Upload to IPFS' },
  { id: 3, label: 'Register On-Chain' },
  { id: 4, label: 'Set Wallet' },
];

interface RegistrationStepperProps {
  currentStep: number;
}

export function RegistrationStepper({ currentStep }: RegistrationStepperProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.id;
        const isCurrent = currentStep === step.id;

        return (
          <div key={step.id} className="flex items-center gap-2">
            {idx > 0 && (
              <div
                className={`h-px w-6 shrink-0 md:w-10 ${
                  isCompleted ? 'bg-purple-500' : 'bg-slate-700'
                }`}
              />
            )}
            <div className="flex shrink-0 items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isCompleted
                    ? 'bg-purple-600 text-white'
                    : isCurrent
                      ? 'border-2 border-purple-500 text-purple-400'
                      : 'border border-slate-600 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCurrent
                    ? 'text-purple-300'
                    : isCompleted
                      ? 'text-slate-300'
                      : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
