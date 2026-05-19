export interface User {
  id: string
  username: string
  avatar: string
}

export interface LoginParams {
  username: string
  password: string
}

export interface RegisterParams {
  username: string
  password: string
  inviteCode: string
}
