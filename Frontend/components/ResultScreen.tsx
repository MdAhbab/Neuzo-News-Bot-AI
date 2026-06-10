import type React from 'react';
import { XCircleIcon } from './icons';

interface ResultScreenProps {
  categoryName: string;
  errorMessage?: string;
  onReset: () => void;
}

const RefreshIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V4a1 1 0 011-1zm10 8a1 1 0 011-1h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 111.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);


export const ResultScreen: React.FC<ResultScreenProps> = ({ categoryName, errorMessage, onReset }) => {
  return (
    <div className="panel w-full max-w-2xl p-5 sm:p-8 text-center flex flex-col items-center">
      <XCircleIcon className="h-16 w-16 text-red-400 mb-4" />

      <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
        Something went wrong
      </h2>

      <p className="text-base text-gray-300 mb-8">
        {errorMessage || `The backend service failed to respond while fetching news for ${categoryName}. Please try again.`}
      </p>

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onReset}
          className="btn btn-primary px-6 py-3 shadow-md"
        >
          <RefreshIcon />
          Try again
        </button>
      </div>
    </div>
  );
};