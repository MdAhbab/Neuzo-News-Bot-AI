import type React from 'react';

export enum AppState {
  AUTH,
  SELECTION,
  PROCESSING,
  COMPLETE,
  ERROR,
  REPORT_VIEW,
  JOB_HISTORY,
}

export interface Category {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  defaultSources?: string[];
  isCustom?: boolean;
}

export type JobStatus = 'Pending' | 'Processing' | 'Complete' | 'Error';

export interface Job {
  jobId: string;
  status: JobStatus;
  step?: string;
  reportUrl?: string;
  reportName?: string;
  message?: string;
  reportContent?: string;
  usedSources?: string[];
  agentActions?: string[];
  partialReportContent?: string;
}

// Enhanced job history item from API
export interface JobHistoryItem {
  job_id: string;
  status: JobStatus;
  category_name: string;
  category_id: string;
  report_name?: string;
  created_at: string;
  completed_at?: string;
  articles_count?: number;
  verified_count?: number;
}

// API Response types
export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
  expires_in_hours: number;
}

export interface User {
  id: number;
  email: string;
  full_name?: string;
}

export interface ApiError {
  error: string;
}

// Source types
export interface NewsSource {
  id: number;
  source_url: string;
  source_name?: string;
  source_type: 'web' | 'rss' | 'api';
  reliability_score: number;
  last_checked?: string;
}