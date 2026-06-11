import type { Job, AuthResponse, User, JobHistoryItem, ApiCategory, NewsEngine } from '../types';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Token storage
let authToken: string | null = localStorage.getItem('neuzo_auth_token');

// Set auth token
export const setAuthToken = (token: string) => {
  authToken = token;
  localStorage.setItem('neuzo_auth_token', token);
};

// Clear auth token
export const clearAuthToken = () => {
  authToken = null;
  localStorage.removeItem('neuzo_auth_token');
};

// Helper function for API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Only auto-clear session and reload on 401 for non-auth endpoints
    if (response.status === 401) {
      const isAuthEndpoint =
        endpoint === '/auth/login' || endpoint === '/auth/signup';
      if (!isAuthEndpoint) {
        clearAuthToken();
        window.location.reload();
        throw new Error('Session expired. Please log in again.');
      }
    }

    const error = await response.json().catch(() => ({ error: 'API request failed' }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
};

// ============= Authentication API =============

export const signup = async (
  email: string,
  password: string,
  full_name?: string
): Promise<AuthResponse> => {
  const data: AuthResponse = await apiCall('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name }),
  });

  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
};

export const login = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  const data: AuthResponse = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
};

export const logout = async (): Promise<void> => {
  try {
    await apiCall('/auth/logout', { method: 'POST' });
  } finally {
    clearAuthToken();
  }
};

export const getCurrentUser = async (): Promise<User> => {
  return apiCall('/auth/me');
};

// ============= Category API =============

export const getCategories = async (): Promise<ApiCategory[]> => {
  return apiCall('/categories');
};

export const createCategory = async (
  category_id: string,
  name: string,
  icon_name: string = 'NewspaperIcon'
): Promise<ApiCategory> => {
  return apiCall('/categories', {
    method: 'POST',
    body: JSON.stringify({ category_id, name, icon_name }),
  });
};

export const suggestCategory = async (
  prompt: string
): Promise<{
  category_id: string;
  name: string;
  icon_name: string;
  recommended_sources: { url: string; name: string }[];
}> => {
  return apiCall('/categories/suggest', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
};

// ============= Source API =============

export const getSources = async (category_id: string): Promise<unknown[]> => {
  return apiCall(`/sources/${category_id}`);
};

export const addSource = async (
  category_id: string,
  source_url: string,
  source_name?: string,
  source_type?: 'web' | 'rss' | 'api',
  reliability_score?: number
): Promise<unknown> => {
  return apiCall(`/sources/${category_id}`, {
    method: 'POST',
    body: JSON.stringify({ source_url, source_name, source_type, reliability_score }),
  });
};

// ============= Job API =============

export const startJob = (
  category: string,
  sources: string[],
  engine: NewsEngine = 'auto'
): Promise<Job> => {
  return apiCall('/jobs/start', {
    method: 'POST',
    body: JSON.stringify({ category, sources, engine }),
  });
};

export const getJobStatus = (jobId: string): Promise<Job> => {
  return apiCall(`/jobs/${jobId}/status`);
};

export const getJobHistory = (limit: number = 50): Promise<JobHistoryItem[]> => {
  return apiCall(`/jobs/history?limit=${limit}`);
};

export const downloadReportFile = async (
  jobId: string,
  fallbackName?: string
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/download`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error(`Download failed with status ${response.status}`);
  }

  // Derive filename from Content-Disposition or fall back
  let filename = fallbackName || 'neuzo_report.docx';
  const disposition = response.headers.get('Content-Disposition');
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";\n]+)/i);
    if (match && match[1]) {
      filename = decodeURIComponent(match[1].replace(/['"]/g, ''));
    }
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
