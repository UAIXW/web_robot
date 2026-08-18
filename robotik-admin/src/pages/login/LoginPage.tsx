import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/shared/api/supabase'
import { checkAdmin, useAuthStore } from '@/shared/stores/auth.store'

export default function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [email, setEmail] = useState('demo@webrobot.dev')
  const [password, setPassword] = useState('demo123456')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      if (!data.user) throw new Error('登录失败')

      const isAdmin = await checkAdmin()
      if (!isAdmin) {
        await supabase.auth.signOut()
        throw new Error('该账号没有管理员权限')
      }
      setSession({ id: data.user.id, email: data.user.email ?? '' }, isAdmin)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
      <div className="w-[400px] rounded-2xl border border-slate-200/10 bg-[#0d1424] p-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Robotik Admin</h1>
          <p className="text-sm text-slate-500 mt-1.5">SDK 运营管理平台</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200/10 bg-[#0a0f1e] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-indigo-500"
              placeholder="admin@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200/10 bg-[#0a0f1e] px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:border-indigo-500"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3.5 text-xs text-red-400">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                登录中…
              </span>
            ) : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
