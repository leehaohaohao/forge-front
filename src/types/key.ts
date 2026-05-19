export interface ApiKey {
  id: string
  provider: string
  name: string
  key: string
  description: string
  quota: string
  createdAt: string
}

export interface KeyProvider {
  id: string
  name: string
  icon: string
}
