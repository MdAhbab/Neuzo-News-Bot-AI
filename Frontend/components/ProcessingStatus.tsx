import type React from 'react';
import { CheckCircleIcon, SpinnerIcon } from './icons';

interface ProcessingStatusProps {
  steps: string[];
  currentStep: string;
  categoryName: string;
  partialReportContent?: string;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ steps, currentStep, categoryName, partialReportContent }) => {
  const currentStepIndex = steps.findIndex(step => step === currentStep);
  const progressPercentage = currentStepIndex >= 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  return (
    <div className="bg-black/30 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-3xl text-center border border-white/10">
      <h2 className="text-3xl font-bold text-white mb-2">Neuzo is on the job...</h2>
      <p className="text-lg text-gray-300 mb-6">
        Your <span className="font-semibold text-blue-400">{categoryName}</span> report is being generated.
      </p>
      
      <div className="w-full bg-white/10 rounded-full h-2.5 mb-8">
        <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }}></div>
      </div>

      <div className="space-y-4 text-left mb-8">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div key={step} className="flex items-center text-lg transition-all duration-300">
              <div className="flex-shrink-0 h-8 w-8 mr-4 flex items-center justify-center">
                {isCompleted ? (
                    <CheckCircleIcon className="h-7 w-7 text-green-400" />
                ) : isCurrent ? (
                    <SpinnerIcon className="h-7 w-7 text-blue-400" />
                ) : (
                    <div className="h-7 w-7 flex items-center justify-center">
                        <div className="h-3 w-3 rounded-full bg-gray-600"></div>
                    </div>
                )}
              </div>
              <span className={`transition-colors duration-300 ${
                isCompleted ? 'text-gray-400 line-through' :
                isCurrent ? 'text-white font-semibold' :
                'text-gray-500'
              }`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>

      {partialReportContent && (
        <div className="text-left bg-black/20 p-4 rounded-lg border border-white/10 animate-fade-in">
          <h3 className="text-lg font-semibold text-white mb-2">Report Preview</h3>
          <p className="text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {partialReportContent}...
          </p>
        </div>
      )}
    </div>
  );
};