import api, { type ApiResponse } from '@/lib/api';

export interface DashboardStats {
  token_count: number;
  workspace_count: number;
  link_count: number;
}

export async function getDashboardStats() {
  const res = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
  return res.data.data;
}
