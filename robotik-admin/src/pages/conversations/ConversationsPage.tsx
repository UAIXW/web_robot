import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { schemaFetch } from '@/shared/api/schema-fetch'
import type { Conversation, Message } from '@/shared/types'
import { formatDateTime } from '@/shared/lib/utils'
import { ChevronRight, User, Bot, Wrench, MessageSquare } from 'lucide-react'

export default function ConversationsPage() {
  const [selectedApp, setSelectedApp] = useState<string>('')
  const [selectedConv, setSelectedConv] = useState<string | null>(null)

  const { data: conversations } = useQuery({
    queryKey: ['conversations', selectedApp],
    queryFn: async () => {
      let path = '/conversations?select=id,app_id,title,user_id,created_at,updated_at&order=created_at.desc&limit=50'
      if (selectedApp) path += `&app_id=eq.${selectedApp}`
      const res = await schemaFetch('robotik', path)
      if (!res.ok) throw new Error('Failed to fetch conversations')
      return res.json() as Promise<Conversation[]>
    },
  })

  const { data: messages } = useQuery({
    queryKey: ['messages', selectedConv],
    enabled: !!selectedConv,
    queryFn: async () => {
      const res = await schemaFetch(
        'robotik',
        `/messages?select=id,conversation_id,role,content,tool_name,created_at&conversation_id=eq.${selectedConv}&order=id.asc`,
      )
      if (!res.ok) throw new Error('Failed to fetch messages')
      return res.json() as Promise<Message[]>
    },
  })

  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 border-r border-slate-200/10 flex flex-col bg-[#0d1424]">
        <div className="px-6 py-6 border-b border-slate-200/10">
          <h2 className="text-sm font-semibold text-white mb-3.5">会话列表</h2>
          <select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            className="w-full rounded-xl border border-slate-200/10 bg-slate-200/5 px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="">全部应用</option>
            <option value="default">default</option>
            <option value="knowledge">knowledge</option>
          </select>
        </div>
        <div className="flex-1 overflow-auto">
          {(conversations ?? []).map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              className={`w-full text-left px-6 py-4 border-b border-slate-200/5 transition-colors ${
                selectedConv === conv.id
                  ? 'bg-indigo-600/10 border-l-2 border-l-indigo-500'
                  : 'hover:bg-slate-200/5'
              }`}
            >
              <div className="text-sm text-slate-200 truncate">{conv.title || '(无标题)'}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-indigo-400 font-mono">{conv.app_id}</span>
                <span className="text-xs text-slate-600">{formatDateTime(conv.created_at)}</span>
              </div>
            </button>
          ))}
          {(!conversations || conversations.length === 0) && (
            <div className="px-6 py-12 text-center text-sm text-slate-600">暂无会话</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="px-7 py-6 border-b border-slate-200/10">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="font-medium">会话洞察</span>
            {selectedConv && <ChevronRight className="h-4 w-4 text-slate-600" />}
            {selectedConv && <span className="text-xs text-slate-500 font-mono">{selectedConv.slice(0, 8)}</span>}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-8 space-y-6">
          {(messages ?? []).map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  msg.role === 'tool' ? 'bg-amber-500/10' : 'bg-indigo-500/10'
                }`}>
                  {msg.role === 'tool'
                    ? <Wrench className="h-4 w-4 text-amber-400" />
                    : <Bot className="h-4 w-4 text-indigo-400" />
                  }
                </div>
              )}
              <div
                className={`max-w-[60%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : msg.role === 'tool'
                    ? 'bg-amber-950/30 border border-amber-900/40 text-amber-200'
                    : 'bg-slate-200/5 text-slate-200'
                }`}
              >
                {msg.role === 'tool' && msg.tool_name && (
                  <div className="text-xs text-amber-400 mb-2 font-mono">{msg.tool_name}</div>
                )}
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
              {msg.role === 'user' && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10">
                  <User className="h-4 w-4 text-indigo-400" />
                </div>
              )}
            </div>
          ))}
          {selectedConv && (!messages || messages.length === 0) && (
            <div className="text-center text-sm text-slate-600 py-12">暂无消息</div>
          )}
          {!selectedConv && (
            <div className="flex flex-col items-center justify-center py-28 text-slate-600">
              <MessageSquare className="h-12 w-12 mb-4 opacity-40" />
              <div className="text-sm">选择左侧会话查看消息</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
