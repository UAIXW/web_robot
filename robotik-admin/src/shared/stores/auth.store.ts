import { create } from 'zustand'
import { supabase, env } from '@/shared/api/supabase'

interface AuthUser {
  id: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  isAdmin: boolean
  isAuthenticated: boolean
  loading: boolean
  setLoading: (v: boolean) => void
  setSession: (user: AuthUser | null, isAdmin: boolean) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAdmin: false,
  isAuthenticated: false,
  loading: true,
  setLoading: (v) => set({ loading: v }),
  setSession: (user, isAdmin) =>
    set({ user, isAdmin, isAuthenticated: !!user, loading: false }),
  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, isAdmin: false, isAuthenticated: false, loading: false })
  },
}))

export async function checkAdmin(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return false

  const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: {
      'apikey': env.supabaseAnonKey,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'robotik',
      'Content-Profile': 'robotik',
    },
    body: '{}',
  })
  if (!res.ok) return false
  const data = await res.json()
  return data === true
}

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    useAuthStore.getState().setSession(null, false)
    return
  }
  const isAdmin = await checkAdmin()
  useAuthStore.getState().setSession(
    { id: session.user.id, email: session.user.email ?? '' },
    isAdmin,
  )

  supabase.auth.onAuthStateChange(async (_event, newSession) => {
    if (!newSession?.user) {
      useAuthStore.getState().setSession(null, false)
      return
    }
    const admin = await checkAdmin()
    useAuthStore.getState().setSession(
      { id: newSession.user.id, email: newSession.user.email ?? '' },
      admin,
    )
  })
}
