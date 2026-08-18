import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { AuthGuard, AdminGuard } from './guards'

const AdminLayout = lazy(() => import('@/app/layouts/AdminLayout'))
const LoginPage = lazy(() => import('@/pages/login/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const AppsPage = lazy(() => import('@/pages/apps/AppsPage'))
const ConversationsPage = lazy(() => import('@/pages/conversations/ConversationsPage'))
const AdminsPage = lazy(() => import('@/pages/admins/AdminsPage'))

function Fallback(): ReactNode {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  )
}

export const routes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <Suspense fallback={<Fallback />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    element: (
      <AuthGuard>
        <AdminGuard>
          <Suspense fallback={<Fallback />}>
            <AdminLayout />
          </Suspense>
        </AdminGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Suspense fallback={<Fallback />}><DashboardPage /></Suspense> },
      { path: 'apps', element: <Suspense fallback={<Fallback />}><AppsPage /></Suspense> },
      { path: 'conversations', element: <Suspense fallback={<Fallback />}><ConversationsPage /></Suspense> },
      { path: 'admins', element: <Suspense fallback={<Fallback />}><AdminsPage /></Suspense> },
    ],
  },
  { path: '*', element: <div className="p-8 text-center text-slate-400">404 — 页面不存在</div> },
]
