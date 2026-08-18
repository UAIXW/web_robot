import { useQuery } from '@tanstack/react-query'
import { schemaRpc } from '@/shared/api/schema-fetch'
import type { StatsOverview } from '@/shared/types'
import { formatNumber } from '@/shared/lib/utils'
import { Activity, MessageSquare, Wrench, Users, Clock, Zap, AlertTriangle, AppWindow } from 'lucide-react'

const METRICS = [
  { key: 'apps_total', label: '接入应用', icon: AppWindow, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'apps_active_today', label: '今日活跃应用', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'conversations_total', label: '总会话数', icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { key: 'conversations_today', label: '今日会话', icon: MessageSquare, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { key: 'messages_total', label: '总消息数', icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { key: 'tool_calls_total', label: '工具调用次数', icon: Wrench, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'active_users_today', label: '今日活跃用户', icon: Users, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { key: 'tokens_input_total', label: '输入 Token', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { key: 'tokens_output_total', label: '输出 Token', icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { key: 'avg_latency_ms', label: '平均延迟', icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10', suffix: 'ms' },
  { key: 'error_rate', label: '错误率', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', suffix: '%' },
] as const

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats-overview'],
    queryFn: () => schemaRpc<StatsOverview>('robotik', 'stats_overview'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  if (!data || 'error' in data) {
    return <div className="px-14 py-12 text-slate-400">暂无数据或无权限</div>
  }

  return (
    <div className="px-14 py-12 max-w-7xl">
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white tracking-tight">运营总览</h2>
        <p className="text-sm text-slate-500 mt-2">SDK 使用情况和关键指标</p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {METRICS.map((m) => {
          const Icon = m.icon
          return (
            <div
              key={m.key}
              className="rounded-2xl border border-slate-200/10 bg-[#0d1424] p-7 transition-all hover:border-slate-200/20 hover:bg-[#101830]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${m.bg}`}>
                  <Icon className={`h-5 w-5 ${m.color}`} />
                </div>
              </div>
              <div className="text-3xl font-bold text-white tracking-tight">
                {formatNumber(Number(data[m.key as keyof StatsOverview]) || 0)}
                {'suffix' in m && m.suffix && (
                  <span className="text-base text-slate-500 ml-1.5 font-normal">{m.suffix}</span>
                )}
              </div>
              <div className="text-sm text-slate-500 mt-2.5">{m.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
