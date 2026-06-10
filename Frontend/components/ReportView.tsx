import React, { useState } from 'react';
import type { Job } from '../types';
import { ArrowDownTrayIcon, NewspaperIcon, CheckCircleIcon, DocumentTextIcon, LinkIcon, AdjustmentsIcon } from './icons';
import * as NeuzoApi from '../services/neuzoApi';

interface ReportViewProps {
  job: Job;
  onReset: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ job, onReset }) => {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      await NeuzoApi.downloadReportFile(job.jobId, job.reportName);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to download report. Please try again.';
      setDownloadError(msg);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-black/30 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl w-full max-w-4xl animate-fade-in">
      <div className="text-center mb-8">
        <NewspaperIcon className="h-16 w-16 mx-auto text-blue-400 mb-3" />
        <h1 className="text-3xl font-extrabold text-white">{job.reportName}</h1>
        <p className="text-md text-gray-400 mt-1">Report generated successfully</p>
        {(job.articlesCount !== undefined || job.verifiedCount !== undefined) && (
          <p className="text-sm text-gray-500 mt-1">
            {job.articlesCount !== undefined && `${job.articlesCount} articles analysed`}
            {job.articlesCount !== undefined && job.verifiedCount !== undefined && ' · '}
            {job.verifiedCount !== undefined && `${job.verifiedCount} verified`}
          </p>
        )}
      </div>

      <div className="space-y-8">
        {/* Report Content Section — only shown when content exists */}
        {job.reportContent && (
          <div className="bg-white/5 p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center gap-3">
              <DocumentTextIcon className="h-6 w-6 text-blue-400" />
              Synthesized Report
            </h2>
            <p className="text-gray-300 leading-relaxed">{job.reportContent}</p>
          </div>
        )}

        {/* Sources Section */}
        {job.usedSources && job.usedSources.length > 0 && (
          <div className="bg-white/5 p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center gap-3">
              <LinkIcon className="h-6 w-6 text-blue-400" />
              Information Sources
            </h2>
            <ul className="space-y-2">
              {job.usedSources.map((source, index) => (
                <li
                  key={index}
                  className="flex items-center bg-black/20 p-3 rounded-md hover:bg-black/40 transition-colors"
                >
                  <LinkIcon className="h-5 w-5 mr-3 text-gray-500 flex-shrink-0" />
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline truncate"
                  >
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Agent Actions Section */}
        {job.agentActions && job.agentActions.length > 0 && (
          <div className="bg-white/5 p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center gap-3">
              <AdjustmentsIcon className="h-6 w-6 text-blue-400" />
              Agent Actions Performed
            </h2>
            <ul className="space-y-3">
              {job.agentActions.map((action, index) => (
                <li key={index} className="flex items-center text-gray-300">
                  <CheckCircleIcon className="h-5 w-5 mr-3 text-green-400 flex-shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-blue-400 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            {downloading ? 'Downloading…' : 'Download Report (.docx)'}
          </button>
          {downloadError && (
            <p className="text-sm text-red-400">{downloadError}</p>
          )}
        </div>
        <button
          onClick={onReset}
          className="w-full sm:w-auto px-6 py-3 bg-white/10 text-gray-200 font-semibold rounded-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-white/50 transition-colors duration-200"
        >
          Start New Report
        </button>
      </div>
    </div>
  );
};
