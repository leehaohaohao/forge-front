import { create } from 'zustand'
import type { ApiKey, KeyProvider } from '../types'

const defaultProviders: KeyProvider[] = [
  { id: 'openai', name: 'OpenAI', icon: 'OA' },
  { id: 'anthropic', name: 'Anthropic', icon: 'AN' },
  { id: 'google', name: 'Google AI', icon: 'GG' },
  { id: 'baidu', name: '百度文心', icon: 'BD' },
  { id: 'alibaba', name: '阿里通义', icon: 'AL' },
  { id: 'zhipu', name: '智谱ChatGLM', icon: 'ZP' },
  { id: 'moonshot', name: '月之暗面', icon: 'MK' },
  { id: 'deepseek', name: 'DeepSeek', icon: 'DS' },
  { id: 'other', name: '其他', icon: 'OT' },
]

interface KeysState {
  keys: ApiKey[]
  providers: KeyProvider[]
  addKey: (key: ApiKey) => void
  updateKey: (id: string, data: Partial<ApiKey>) => void
  deleteKey: (id: string) => void
}

export const useKeysStore = create<KeysState>((set) => ({
  keys: JSON.parse(localStorage.getItem('apiKeys') || '[]'),
  providers: defaultProviders,
  addKey: (key) =>
    set((state) => {
      const updated = [...state.keys, key]
      localStorage.setItem('apiKeys', JSON.stringify(updated))
      return { keys: updated }
    }),
  updateKey: (id, data) =>
    set((state) => {
      const updated = state.keys.map((k) => (k.id === id ? { ...k, ...data } : k))
      localStorage.setItem('apiKeys', JSON.stringify(updated))
      return { keys: updated }
    }),
  deleteKey: (id) =>
    set((state) => {
      const updated = state.keys.filter((k) => k.id !== id)
      localStorage.setItem('apiKeys', JSON.stringify(updated))
      return { keys: updated }
    }),
}))
