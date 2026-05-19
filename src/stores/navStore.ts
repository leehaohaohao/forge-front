import { create } from 'zustand'
import type { NavCategory, NavSite, SearchEngine } from '../types'

const defaultCategories: NavCategory[] = [
  {
    id: 'dev',
    name: '开发工具',
    icon: 'Code',
    sites: [
      { id: '1', name: 'GitHub', url: 'https://github.com', icon: '🐙', description: '代码托管平台', categoryId: 'dev' },
      { id: '2', name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: '📚', description: '技术问答', categoryId: 'dev' },
      { id: '3', name: 'VS Code', url: 'https://code.visualstudio.com', icon: '💻', description: '代码编辑器', categoryId: 'dev' },
    ],
  },
  {
    id: 'ai',
    name: 'AI 工具',
    icon: 'SmartToy',
    sites: [
      { id: '4', name: 'ChatGPT', url: 'https://chat.openai.com', icon: '🤖', description: 'OpenAI 对话模型', categoryId: 'ai' },
      { id: '5', name: 'Claude', url: 'https://claude.ai', icon: '🧠', description: 'Anthropic 对话模型', categoryId: 'ai' },
      { id: '6', name: 'Gemini', url: 'https://gemini.google.com', icon: '✨', description: 'Google AI', categoryId: 'ai' },
    ],
  },
  {
    id: 'news',
    name: '资讯',
    icon: 'Article',
    sites: [
      { id: '7', name: '掘金', url: 'https://juejin.cn', icon: '⛏️', description: '技术社区', categoryId: 'news' },
      { id: '8', name: 'V2EX', url: 'https://v2ex.com', icon: '💬', description: '创意工作者社区', categoryId: 'news' },
    ],
  },
]

const defaultEngines: SearchEngine[] = [
  { id: 'google', name: 'Google', icon: '🔍', url: 'https://www.google.com/search?q=' },
  { id: 'bing', name: 'Bing', icon: '🔎', url: 'https://www.bing.com/search?q=' },
  { id: 'baidu', name: '百度', icon: '🅱️', url: 'https://www.baidu.com/s?wd=' },
  { id: 'github', name: 'GitHub', icon: '🐙', url: 'https://github.com/search?q=' },
]

interface NavState {
  categories: NavCategory[]
  searchEngines: SearchEngine[]
  currentEngine: SearchEngine
  background: string
  addCategory: (category: NavCategory) => void
  updateCategory: (id: string, data: Partial<NavCategory>) => void
  deleteCategory: (id: string) => void
  addSite: (categoryId: string, site: NavSite) => void
  updateSite: (siteId: string, data: Partial<NavSite>) => void
  deleteSite: (siteId: string) => void
  setCurrentEngine: (engine: SearchEngine) => void
  setBackground: (bg: string) => void
}

export const useNavStore = create<NavState>((set) => ({
  categories: JSON.parse(localStorage.getItem('navCategories') || 'null') || defaultCategories,
  searchEngines: defaultEngines,
  currentEngine: defaultEngines[0],
  background: localStorage.getItem('navBackground') || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  addCategory: (category) =>
    set((state) => {
      const updated = [...state.categories, category]
      localStorage.setItem('navCategories', JSON.stringify(updated))
      return { categories: updated }
    }),
  updateCategory: (id, data) =>
    set((state) => {
      const updated = state.categories.map((c) => (c.id === id ? { ...c, ...data } : c))
      localStorage.setItem('navCategories', JSON.stringify(updated))
      return { categories: updated }
    }),
  deleteCategory: (id) =>
    set((state) => {
      const updated = state.categories.filter((c) => c.id !== id)
      localStorage.setItem('navCategories', JSON.stringify(updated))
      return { categories: updated }
    }),
  addSite: (categoryId, site) =>
    set((state) => {
      const updated = state.categories.map((c) =>
        c.id === categoryId ? { ...c, sites: [...c.sites, site] } : c
      )
      localStorage.setItem('navCategories', JSON.stringify(updated))
      return { categories: updated }
    }),
  updateSite: (siteId, data) =>
    set((state) => {
      const updated = state.categories.map((c) => ({
        ...c,
        sites: c.sites.map((s) => (s.id === siteId ? { ...s, ...data } : s)),
      }))
      localStorage.setItem('navCategories', JSON.stringify(updated))
      return { categories: updated }
    }),
  deleteSite: (siteId) =>
    set((state) => {
      const updated = state.categories.map((c) => ({
        ...c,
        sites: c.sites.filter((s) => s.id !== siteId),
      }))
      localStorage.setItem('navCategories', JSON.stringify(updated))
      return { categories: updated }
    }),
  setCurrentEngine: (engine) => set({ currentEngine: engine }),
  setBackground: (bg) => {
    localStorage.setItem('navBackground', bg)
    set({ background: bg })
  },
}))
