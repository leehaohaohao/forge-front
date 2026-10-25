import axios from 'axios';
import { normalizeApiError, type ApiError } from './api-error';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageData<T = unknown> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

const api = axios.create({
  baseURL: '/forge',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('forge_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function rejectResponse(error: ApiError) {
  if (error.kind === 'unauthorized') {
    localStorage.removeItem('forge_token');
    localStorage.removeItem('forge_token_time');
    localStorage.removeItem('forge_user');
    // Auth store clears memory and routes to login; vault listeners destroy keys.
    window.dispatchEvent(new Event('forge-auth-invalid'));
  }
  return Promise.reject(error);
}

// Presentation belongs to the caller's App.useApp() instance, never this interceptor.
api.interceptors.response.use(
  (res) => res.data?.code === 0 ? res : rejectResponse(normalizeApiError(undefined,res)),
  (error) => rejectResponse(normalizeApiError(error)),
);

export default api;
