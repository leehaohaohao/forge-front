import axios from 'axios';
import type { Token, TokenFormValues, TokenQueryParams } from '@/types/token';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface PageData {
  list: Token[];
  total: number;
  page: number;
  page_size: number;
}

const api = axios.create({
  baseURL: '/api',
});

export async function getTokens(params?: TokenQueryParams) {
  const res = await api.get<ApiResponse<PageData>>('/token', { params });
  const { list, total } = res.data.data;
  return { data: list, total };
}

export async function getToken(id: number) {
  const res = await api.get<ApiResponse<Token>>(`/token/${id}`);
  return res.data.data;
}

export async function createToken(data: TokenFormValues) {
  const res = await api.post<ApiResponse<Token>>('/token', data);
  return res.data.data;
}

export async function updateToken(id: number, data: Partial<TokenFormValues>) {
  const res = await api.put<ApiResponse<Token>>(`/token/${id}`, data);
  return res.data.data;
}

export async function deleteToken(id: number) {
  await api.delete(`/token/${id}`);
}
