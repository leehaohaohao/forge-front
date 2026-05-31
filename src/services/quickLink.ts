import api, { type ApiResponse } from '@/lib/api';
import type { QuickLink, CreateLinkParams, UpdateLinkParams } from '@/types/quickLink';

export async function getQuickLinks(params?: { workspace_id?: number; keyword?: string }) {
  const res = await api.get<ApiResponse<QuickLink[]>>('/quick-link', { params });
  return res.data.data;
}

export async function createQuickLink(data: CreateLinkParams) {
  const res = await api.post<ApiResponse<QuickLink>>('/quick-link', data);
  return res.data.data;
}

export async function updateQuickLink(id: number, data: UpdateLinkParams) {
  const res = await api.put<ApiResponse<QuickLink>>(`/quick-link/${id}`, data);
  return res.data.data;
}

export async function deleteQuickLink(id: number) {
  await api.delete(`/quick-link/${id}`);
}

export async function removeLinkFromWorkspace(linkId: number, workspaceId: number) {
  await api.delete(`/quick-link/${linkId}/workspace/${workspaceId}`);
}
