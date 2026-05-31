import { create } from 'zustand';
import { createCloudAdapter, type StorageAdapter, type QueryParams } from '@/lib/adapters/cloud-adapter';
import type { Token, TokenFormValues } from '@/types/token';

const tokenAdapter: StorageAdapter<Token> = createCloudAdapter('token');

interface TokenState {
  tokens: Token[];
  loading: boolean;
  pagination: { current: number; pageSize: number; total: number };
  fetchTokens: (params?: QueryParams) => Promise<void>;
  createToken: (data: TokenFormValues) => Promise<void>;
  updateToken: (id: number, data: Partial<TokenFormValues>) => Promise<void>;
  deleteToken: (id: number) => Promise<void>;
  setPagination: (pagination: Partial<{ current: number; pageSize: number }>) => void;
}

export const useTokenStore = create<TokenState>((set, get) => ({
  tokens: [],
  loading: false,
  pagination: { current: 1, pageSize: 10, total: 0 },

  fetchTokens: async (params?: QueryParams) => {
    set({ loading: true });
    try {
      const { pagination } = get();
      const res = await tokenAdapter.list({
        page: pagination.current,
        page_size: pagination.pageSize,
        ...params,
      });
      set({ tokens: res.data, pagination: { ...pagination, total: res.total } });
    } finally {
      set({ loading: false });
    }
  },

  createToken: async (data) => {
    await tokenAdapter.create(data as Partial<Token>);
    await get().fetchTokens();
  },

  updateToken: async (id, data) => {
    await tokenAdapter.update(id, data);
    await get().fetchTokens();
  },

  deleteToken: async (id) => {
    await tokenAdapter.delete(id);
    await get().fetchTokens();
  },

  setPagination: (pagination) => {
    set((state) => ({ pagination: { ...state.pagination, ...pagination } }));
  },
}));
