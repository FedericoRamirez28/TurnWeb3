import { createContext } from 'react'
import type { AuthUser } from '@/api/authApi'

export type AuthCtx = {
  user: AuthUser | null
  loading: boolean

  login: (
    username: string,
    password: string,
    remember: boolean
  ) => Promise<AuthUser>

  register: (
    username: string,
    password: string,
    displayName?: string,
    remember?: boolean
  ) => Promise<AuthUser>

  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthCtx | null>(null)
