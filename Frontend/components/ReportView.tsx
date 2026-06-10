import React, { useState } from 'react';
import type { Job } from '../types';
import { ArrowDownTrayIcon, NewspaperIcon, CheckCircleIcon, DocumentTextIcon, LinkIcon, AdjustmentsIcon } from './icons';
import * as NeuzoApi from '../services/neuzoApi';

interface ReportViewProps {
  job: Job;
  categoryName?: string;
  onReset: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ job, categoryName, onReset }) => {
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
    <div className="panel w-full max-w-4xl p-5 sm:p-8 animate-fade-in">
      <div className="text-center mb-8">
        <NewspaperIcon className="h-14 w-14 mx-auto text-blue-400 mb-3" />
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {categoryName ? `${categoryName} Report` : 'News Report'}
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          {job.reportName}
          {(job.articlesCount !== undefined || job.verifiedCount !== undefined) && (
            <>
              {' · '}
              {job.articlesCount !== undefined && `${job.articlesCount} articles analysed`}
              {job.articlesCount !== undefined && job.verifiedCount !== undefined && ', '}
              {job.verifiedCount !== undefined && `${job.verifiedCount} verified`}
            </>
          )}
        </p>
      </div>

      <div className="space-y-6">
        {/* Report Content Section — only shown when content exists */}
        {job.reportContent && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center gap-3">
              <DocumentTextIcon className="h-5 w-5 text-blue-400" />
              Synthesised report
            </h2>
            <p className="text-gray-300 leading-relaxed">{job.reportContent}</p>
          </div>
        )}

        {/* Sources Section */}
        {job.usedSources && job.usedSources.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center gap-3">
              <LinkIcon className="h-5 w-5 text-blue-400" />
              Information sources
            </h2>
            <ul className="space-y-2">
              {job.usedSources.map((source, index) => (
                <li
                  key={index}
                  className="flex items-center bg-black/20 p-3 rounded-lg hover:bg-black/40 transition-colors"
                >
                  <LinkIcon className="h-5 w-5 mr-3 text-gray-400 flex-shrink-0" />
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
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-3 mb-4 flex items-center gap-3">
              <AdjustmentsIcon className="h-5 w-5 text-blue-400" />
              Agent actions performed
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
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="btn btn-primary w-full sm:w-auto px-6 py-3 shadow-md"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {downloading ? 'Downloading…' : 'Download report (.docx)'}
          </button>
          {downloadError && (
            <p className="text-sm text-red-400">{downloadError}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="btn btn-secondary w-full sm:w-auto px-6 py-3"
        >
          Start a new report
        </button>
      </div>
    </div>
  );
};
