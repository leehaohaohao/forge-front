import axios from 'axios';
import { message } from 'antd';

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

api.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResponse<unknown>;
    if (body.code !== 0) {
      message.error(body.message || '请求失败');
      return Promise.reject(new Error(body.message));
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('forge_token');
      localStorage.removeItem('forge_token_time');
      localStorage.removeItem('forge_user');
      window.location.href = '/app/login';
    }
    return Promise.reject(error);
  },
);

export default api;
