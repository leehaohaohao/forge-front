import api, { type ApiResponse } from '@/lib/api';
import type { Settings } from '@/types/settings';

export async function getSettings() {
  const res = await api.get<ApiResponse<Settings>>('/user/settings');
  return res.data.data;
}

export async function updateSettings(patch: Partial<Settings>) {
  const res = await api.put<ApiResponse<Settings>>('/user/settings', patch);
  return res.data.data;
}

export async function resetSettings() {
  await api.delete('/user/settings');
}
