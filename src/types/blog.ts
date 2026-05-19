export interface BlogPost {
  id: string
  title: string
  content: string
  summary: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
  status: 'draft' | 'published'
}

export interface BlogCategory {
  id: string
  name: string
}
