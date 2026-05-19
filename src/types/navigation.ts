export interface NavSite {
  id: string
  name: string
  url: string
  icon: string
  description: string
  categoryId: string
}

export interface NavCategory {
  id: string
  name: string
  icon: string
  sites: NavSite[]
}

export interface SearchEngine {
  id: string
  name: string
  icon: string
  url: string
}
