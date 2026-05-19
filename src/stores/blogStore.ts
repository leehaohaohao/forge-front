import { create } from 'zustand'
import type { BlogPost } from '../types'

interface BlogState {
  posts: BlogPost[]
  addPost: (post: BlogPost) => void
  updatePost: (id: string, data: Partial<BlogPost>) => void
  deletePost: (id: string) => void
}

export const useBlogStore = create<BlogState>((set) => ({
  posts: JSON.parse(localStorage.getItem('blogPosts') || '[]'),
  addPost: (post) =>
    set((state) => {
      const updated = [...state.posts, post]
      localStorage.setItem('blogPosts', JSON.stringify(updated))
      return { posts: updated }
    }),
  updatePost: (id, data) =>
    set((state) => {
      const updated = state.posts.map((p) => (p.id === id ? { ...p, ...data } : p))
      localStorage.setItem('blogPosts', JSON.stringify(updated))
      return { posts: updated }
    }),
  deletePost: (id) =>
    set((state) => {
      const updated = state.posts.filter((p) => p.id !== id)
      localStorage.setItem('blogPosts', JSON.stringify(updated))
      return { posts: updated }
    }),
}))
