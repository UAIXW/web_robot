import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, AppWindow, MessageSquare, Users, LogOut } from 'lucide-react'
import { useAuthStore, initAuth } from '@/shared/stores/auth.store'
import { cn } from '@/shared/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/apps', label: '应用管理', icon: AppWindow, end: false },
  { to: '/conversations', label: '会话洞察', icon: MessageSquare, end: false },
  { to: '/admins', label: '管理员', icon: Users, end: false },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const { user, isAdmin, loading, logout } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAdmin) {
    navigate('/login')
    return null
  }

  return (
    <div className="flex min-h-screen bg-[#0a0f1e]">
      <aside className="w-72 shrink-0 border-r border-slate-200/10 bg-[#0d1424] flex flex-col">
        <div className="px-7 py-7 border-b border-slate-200/10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Robotik</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">Admin Console</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-6 space-y-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 mx-4 px-4 py-3 rounded-xl text-sm transition-all',
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-200/5',
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200/10 p-5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-200/5 mb-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-medium text-white">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-300 truncate">{user?.email}</div>
              <div className="text-[11px] text-indigo-400 mt-0.5">管理员</div>
            </div>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/login') }}
            className="flex items-center gap-2 mx-4 px-4 py-2.5 rounded-xl text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
