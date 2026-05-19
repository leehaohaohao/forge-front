import { create } from 'zustand'
import type { Snippet } from '../types'

interface SnippetState {
  snippets: Snippet[]
  addSnippet: (snippet: Snippet) => void
  updateSnippet: (id: string, data: Partial<Snippet>) => void
  deleteSnippet: (id: string) => void
}

export const useSnippetStore = create<SnippetState>((set) => ({
  snippets: JSON.parse(localStorage.getItem('snippets') || '[]'),
  addSnippet: (snippet) =>
    set((state) => {
      const updated = [...state.snippets, snippet]
      localStorage.setItem('snippets', JSON.stringify(updated))
      return { snippets: updated }
    }),
  updateSnippet: (id, data) =>
    set((state) => {
      const updated = state.snippets.map((s) => (s.id === id ? { ...s, ...data } : s))
      localStorage.setItem('snippets', JSON.stringify(updated))
      return { snippets: updated }
    }),
  deleteSnippet: (id) =>
    set((state) => {
      const updated = state.snippets.filter((s) => s.id !== id)
      localStorage.setItem('snippets', JSON.stringify(updated))
      return { snippets: updated }
    }),
}))
