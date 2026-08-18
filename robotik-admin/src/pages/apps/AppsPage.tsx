import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schemaFetch } from '@/shared/api/schema-fetch'
import type { SiteConfig } from '@/shared/types'
import { formatDateTime } from '@/shared/lib/utils'
import { Plus, X } from 'lucide-react'

export default function AppsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<SiteConfig | null>(null)
  const [newTool, setNewTool] = useState('')

  const { data: apps, isLoading } = useQuery({
    queryKey: ['site-configs'],
    queryFn: async () => {
      const res = await schemaFetch('robotik', '/site_configs?select=*')
      if (!res.ok) throw new Error('Failed to fetch site_configs')
      return res.json() as Promise<SiteConfig[]>
    },
  })

  const update = useMutation({
    mutationFn: async (app: SiteConfig) => {
      const res = await schemaFetch('robotik', `/site_configs?id=eq.${app.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          robot_name: app.robot_name,
          welcome_text: app.welcome_text,
          allowed_tools: app.allowed_tools,
          site_domain: app.site_domain,
        }),
      })
      if (!res.ok) throw new Error('Failed to update')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-configs'] })
      setEditing(null)
    },
  })

  const toggleActive = useMutation({
    mutationFn: async (app: SiteConfig) => {
      const res = await schemaFetch('robotik', `/site_configs?id=eq.${app.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !app.is_active }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['site-configs'] }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="px-14 py-12 max-w-5xl">
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white tracking-tight">应用管理</h2>
        <p className="text-sm text-slate-500 mt-2">管理接入 SDK 的应用配置</p>
      </div>

      <div className="grid gap-6">
        {(apps ?? []).map((app) => (
          <div
            key={app.id}
            className="rounded-2xl border border-slate-200/10 bg-[#0d1424] p-7 transition-all hover:border-slate-200/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  app.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-200/5 text-slate-500'
                }`}>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 3v18" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base text-white">{app.app_id}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      app.is_active
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-200/5 text-slate-500'
                    }`}>
                      {app.is_active ? '启用' : '停用'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1.5">
                    {app.robot_name} · {app.site_domain} · 更新于 {formatDateTime(app.updated_at)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setEditing(app)}
                  className="rounded-xl bg-indigo-600/15 px-4 py-2.5 text-sm text-indigo-400 hover:bg-indigo-600/25 transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => toggleActive.mutate(app)}
                  className="rounded-xl border border-slate-200/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-200/5 transition-colors"
                >
                  {app.is_active ? '停用' : '启用'}
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {(app.allowed_tools ?? []).map((tool) => (
                <span key={tool} className="rounded-lg bg-slate-200/5 px-3 py-1.5 text-xs text-slate-400 font-mono">
                  {tool}
                </span>
              ))}
              {(!app.allowed_tools || app.allowed_tools.length === 0) && (
                <span className="text-sm text-slate-600">无工具白名单（全部开放）</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-[560px] rounded-2xl border border-slate-200/10 bg-[#0d1424] p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-7">
              <h3 className="text-lg font-semibold text-white">编辑应用配置</h3>
              <button onClick={() => setEditing(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2.5">机器人名称</label>
                <input
                  value={editing.robot_name}
                  onChange={(e) => setEditing({ ...editing, robot_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200/10 bg-slate-200/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2.5">欢迎语</label>
                <textarea
                  value={editing.welcome_text}
                  onChange={(e) => setEditing({ ...editing, welcome_text: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200/10 bg-slate-200/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2.5">域名</label>
                <input
                  value={editing.site_domain}
                  onChange={(e) => setEditing({ ...editing, site_domain: e.target.value })}
                  className="w-full rounded-xl border border-slate-200/10 bg-slate-200/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2.5">工具白名单</label>
                <div className="flex flex-wrap gap-2.5 mb-3">
                  {(editing.allowed_tools ?? []).map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/15 px-3 py-1.5 text-sm text-indigo-300"
                    >
                      {tool}
                      <button
                        onClick={() => setEditing({
                          ...editing,
                          allowed_tools: (editing.allowed_tools ?? []).filter((t) => t !== tool),
                        })}
                        className="text-indigo-500 hover:text-indigo-300 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2.5">
                  <input
                    value={newTool}
                    onChange={(e) => setNewTool(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTool.trim()) {
                        e.preventDefault()
                        setEditing({
                          ...editing,
                          allowed_tools: [...(editing.allowed_tools ?? []), newTool.trim()],
                        })
                        setNewTool('')
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-200/10 bg-slate-200/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
                    placeholder="输入工具名按回车添加"
                  />
                  <button
                    onClick={() => {
                      if (newTool.trim()) {
                        setEditing({
                          ...editing,
                          allowed_tools: [...(editing.allowed_tools ?? []), newTool.trim()],
                        })
                        setNewTool('')
                      }
                    }}
                    className="rounded-xl border border-slate-200/10 px-4 py-3 text-sm text-slate-300 hover:bg-slate-200/5 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setEditing(null)}
                className="px-5 py-3 text-sm text-slate-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => update.mutate(editing)}
                disabled={update.isPending}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-sm text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {update.isPending ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
