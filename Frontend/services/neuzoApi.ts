import type { Job } from '../types';

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
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - session expired
    if (response.status === 401) {
      clearAuthToken();
      window.location.reload(); // Reload to show login screen
      throw new Error('Session expired. Please log in again.');
    }
    
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
};

// ============= Authentication API =============

export const signup = async (email: string, password: string, full_name?: string): Promise<any> => {
  const data = await apiCall('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, full_name }),
  });
  
  if (data.token) {
    setAuthToken(data.token);
  }
  
  return data;
};

export const login = async (email: string, password: string): Promise<any> => {
  const data = await apiCall('/auth/login', {
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

// ============= Category API =============

export const getCategories = async (): Promise<any[]> => {
  return apiCall('/categories');
};

export const createCategory = async (category_id: string, name: string, icon_name: string = 'NewspaperIcon'): Promise<any> => {
  return apiCall('/categories', {
    method: 'POST',
    body: JSON.stringify({ category_id, name, icon_name }),
  });
};

// ============= Source API =============

export const getSources = async (category_id: string): Promise<any[]> => {
  return apiCall(`/sources/${category_id}`);
};

export const addSource = async (category_id: string, source_url: string, source_name?: string): Promise<any> => {
  return apiCall(`/sources/${category_id}`, {
    method: 'POST',
    body: JSON.stringify({ source_url, source_name }),
  });
};

// ============= Job API =============

export const startJob = (category: string, sources: string[]): Promise<Job> => {
  return apiCall('/jobs/start', {
    method: 'POST',
    body: JSON.stringify({ category, sources }),
  });
};

export const getJobStatus = (jobId: string): Promise<Job> => {
  return apiCall(`/jobs/${jobId}/status`);
};

export const getJobHistory = (limit: number = 50): Promise<any[]> => {
  return apiCall(`/jobs/history?limit=${limit}`);
};

export const downloadReport = (jobId: string): string => {
  return `${API_BASE_URL}/jobs/${jobId}/download`;
};