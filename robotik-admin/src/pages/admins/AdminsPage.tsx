import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schemaRpc, schemaFetch } from '@/shared/api/schema-fetch'
import type { AdminUser } from '@/shared/types'
import { formatDateTime } from '@/shared/lib/utils'
import { UserPlus, Trash2, Shield } from 'lucide-react'

export default function AdminsPage() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const res = await schemaFetch('robotik', '/admin_list?select=*&order=created_at.desc')
      if (!res.ok) throw new Error('Failed to fetch admins')
      return res.json() as Promise<AdminUser[]>
    },
  })

  const addAdmin = useMutation({
    mutationFn: async (newEmail: string) => {
      const result = await schemaRpc<{ ok: boolean; message?: string }>('robotik', 'add_admin_by_email', { p_email: newEmail })
      if (!result.ok) throw new Error(result.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] })
      setEmail('')
    },
  })

  const removeAdmin = useMutation({
    mutationFn: async (userId: string) => {
      await schemaRpc('robotik', 'remove_admin', { p_user_id: userId })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admins'] }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="px-14 py-12 max-w-4xl">
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white tracking-tight">管理员</h2>
        <p className="text-sm text-slate-500 mt-2">管理系统管理员账号</p>
      </div>

      <div className="rounded-2xl border border-slate-200/10 bg-[#0d1424] p-7 mb-8">
        <label className="block text-sm font-medium text-slate-400 mb-3.5">添加管理员</label>
        <div className="flex gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && email && addAdmin.mutate(email)}
            placeholder="输入用户邮箱添加管理员"
            className="flex-1 rounded-xl border border-slate-200/10 bg-slate-200/5 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={() => email && addAdmin.mutate(email)}
            disabled={!email || addAdmin.isPending}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            {addAdmin.isPending ? '添加中…' : '添加'}
          </button>
        </div>
        {addAdmin.isError && (
          <p className="text-xs text-red-400 mt-3.5">
            {addAdmin.error instanceof Error ? addAdmin.error.message : '添加失败'}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {(admins ?? []).map((admin) => (
          <div
            key={admin.user_id}
            className="flex items-center justify-between rounded-2xl border border-slate-200/10 bg-[#0d1424] px-7 py-5 transition-all hover:border-slate-200/20"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10">
                <Shield className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <div className="text-sm text-white">{admin.email}</div>
                <div className="text-xs text-slate-500 mt-1.5">
                  <span className="text-indigo-400">{admin.role}</span>
                  <span className="mx-2">·</span>
                  {formatDateTime(admin.created_at)}
                </div>
              </div>
            </div>
            <button
              onClick={() => removeAdmin.mutate(admin.user_id)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              移除
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
