import React, { useState, useEffect } from 'react';
import type { JobHistoryItem } from '../types';
import * as NeuzoApi from '../services/neuzoApi';
import { ClockIcon, DocumentTextIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from './icons';

interface JobHistoryProps {
    onBack: () => void;
    onDownload: (jobId: string, reportName?: string) => void;
}

export const JobHistory: React.FC<JobHistoryProps> = ({ onBack, onDownload }) => {
    const [jobs, setJobs] = useState<JobHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchJobHistory();
    }, []);

    const fetchJobHistory = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await NeuzoApi.getJobHistory(50);
            setJobs(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load job history');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Complete':
                return <CheckCircleIcon className="h-5 w-5 text-green-400" />;
            case 'Error':
                return <XCircleIcon className="h-5 w-5 text-red-400" />;
            case 'Processing':
                return <ArrowPathIcon className="h-5 w-5 text-blue-400 animate-spin" />;
            default:
                return <ClockIcon className="h-5 w-5 text-yellow-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
        switch (status) {
            case 'Complete':
                return `${baseClasses} bg-green-500/20 text-green-300`;
            case 'Error':
                return `${baseClasses} bg-red-500/20 text-red-300`;
            case 'Processing':
                return `${baseClasses} bg-blue-500/20 text-blue-300`;
            default:
                return `${baseClasses} bg-yellow-500/20 text-yellow-300`;
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <ClockIcon className="h-7 w-7 text-blue-400" />
                    Report History
                </h2>
                <button
                    onClick={onBack}
                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                    ← Back to Dashboard
                </button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-black/30 rounded-xl p-4 animate-pulse">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <div className="h-5 w-32 bg-gray-700 rounded"></div>
                                    <div className="h-4 w-48 bg-gray-700 rounded"></div>
                                </div>
                                <div className="h-8 w-24 bg-gray-700 rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
                    <p className="text-red-200">{error}</p>
                    <button
                        onClick={fetchJobHistory}
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-colors"
                    >
                        Retry
                    </button>
                </div>
            ) : jobs.length === 0 ? (
                <div className="bg-black/30 rounded-xl p-12 text-center">
                    <DocumentTextIcon className="h-16 w-16 mx-auto text-gray-500 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-300 mb-2">No Reports Yet</h3>
                    <p className="text-gray-400">Generate your first news report to see it here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {jobs.map((job) => (
                        <div
                            key={job.job_id}
                            className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-blue-500/30 transition-all duration-200"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {getStatusIcon(job.status)}
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">
                                            {job.category_name} Report
                                        </h3>
                                        <p className="text-sm text-gray-400">
                                            {formatDate(job.created_at)}
                                            {job.verified_count !== undefined && (
                                                <span className="ml-2">
                                                    • {job.verified_count} verified articles
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className={getStatusBadge(job.status)}>{job.status}</span>

                                    {job.status === 'Complete' && job.report_name && (
                                        <button
                                            onClick={() => onDownload(job.job_id, job.report_name)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <DocumentTextIcon className="h-4 w-4" />
                                            Download
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
