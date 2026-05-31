import api, { type ApiResponse } from '@/lib/api';

interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    status: string;
  };
}

export async function loginApi(phone: string, password: string) {
  const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', { phone, password });
  return res.data.data;
}

export async function registerApi(phone: string, password: string, username: string) {
  const res = await api.post<ApiResponse<null>>('/auth/register', { phone, password, username });
  return res.data.data;
}
