import api, { type ApiResponse, type PageData } from '@/lib/api';

export interface QueryParams {
  page?: number;
  page_size?: number;
  [key: string]: unknown;
}

export interface StorageAdapter<T> {
  list(params?: QueryParams): Promise<{ data: T[]; total: number }>;
  getById(id: string | number): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<void>;
}

export function createCloudAdapter<T>(resource: string): StorageAdapter<T> {
  return {
    async list(params) {
      const res = await api.get<ApiResponse<PageData<T>>>(`/${resource}`, { params });
      const { list, total } = res.data.data;
      return { data: list, total };
    },

    async getById(id) {
      const res = await api.get<ApiResponse<T>>(`/${resource}/${id}`);
      return res.data.data;
    },

    async create(data) {
      const res = await api.post<ApiResponse<T>>(`/${resource}`, data);
      return res.data.data;
    },

    async update(id, data) {
      const res = await api.put<ApiResponse<T>>(`/${resource}/${id}`, data);
      return res.data.data;
    },

    async delete(id) {
      await api.delete(`/${resource}/${id}`);
    },
  };
}
