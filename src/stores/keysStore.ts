import { create } from 'zustand'
import type { ApiKey, KeyProvider } from '../types'

const defaultProviders: KeyProvider[] = [
  { id: 'openai', name: 'OpenAI', icon: '🤖' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠' },
  { id: 'google', name: 'Google AI', icon: '✨' },
  { id: 'baidu', name: '百度文心', icon: '🅱️' },
  { id: 'alibaba', name: '阿里通义', icon: '🅰️' },
  { id: 'zhipu', name: '智谱ChatGLM', icon: '🔬' },
  { id: 'moonshot', name: '月之暗面', icon: '🌙' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🔍' },
  { id: 'other', name: '其他', icon: '🔑' },
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
