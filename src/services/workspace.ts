import api, { type ApiResponse } from '@/lib/api';
import type { Workspace } from '@/types/quickLink';

export async function getWorkspaces() {
  const res = await api.get<ApiResponse<Workspace[]>>('/workspace');
  return res.data.data;
}

export async function createWorkspace(name: string) {
  const res = await api.post<ApiResponse<Workspace>>('/workspace', { name });
  return res.data.data;
}

export async function updateWorkspace(id: number, data: { name?: string; sort_order?: number }) {
  const res = await api.put<ApiResponse<Workspace>>(`/workspace/${id}`, data);
  return res.data.data;
}

export async function deleteWorkspace(id: number) {
  await api.delete(`/workspace/${id}`);
}
