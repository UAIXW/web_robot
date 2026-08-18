import { useState, useEffect, useCallback } from 'react'
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import { init, type WebRobotAPI } from '@robotik/sdk'
import { DocumentList } from './components/DocumentList'
import { DocumentEditor } from './components/DocumentEditor'
import { Login } from './components/Login'
import type { KnowledgeDocument } from './types'
import './app.css'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const SERVER = import.meta.env.VITE_SERVER ?? 'http://localhost:8787'

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, storageKey: 'robotik-knowledge' },
})

const TOOL_LABELS: Record<string, string> = {
  search_knowledge: '检索知识库',
  get_document_detail: '获取文档详情',
  list_categories: '列出分类',
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [robotApi, setRobotApi] = useState<WebRobotAPI | null>(null)
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [editing, setEditing] = useState<KnowledgeDocument | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      robotApi?.destroy()
      setRobotApi(null)
      return
    }
    localStorage.setItem('web_robot.session', JSON.stringify({
      access_token: session.access_token,
      user: { id: session.user.id, email: session.user.email },
    }))

    const api = init({
      appId: 'knowledge',
      server: SERVER,
      toolLabels: TOOL_LABELS,
      suggestions: ['有哪些分类？', '搜索 SDK 相关文档', '介绍一下 Shadow DOM'],
    })
    if (!api) return
    setRobotApi(api)
    return () => api.destroy()
  }, [session])

  const loadDocs = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const res = await fetch(`${SERVER}/v1/knowledge/documents`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (json.code === 200) setDocs(json.data)
    } catch (e) {
      console.error('加载文档失败', e)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) loadDocs()
  }, [session, loadDocs])

  const handleSave = async (doc: Partial<KnowledgeDocument>) => {
    if (!session) return
    const method = doc.id ? 'PATCH' : 'POST'
    const url = doc.id
      ? `${SERVER}/v1/knowledge/documents/${doc.id}`
      : `${SERVER}/v1/knowledge/documents`
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(doc),
    })
    const json = await res.json()
    if (json.code === 200) {
      setShowEditor(false)
      setEditing(null)
      loadDocs()
    }
  }

  const handleDelete = async (id: string) => {
    if (!session) return
    const res = await fetch(`${SERVER}/v1/knowledge/documents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json()
    if (json.code === 200) loadDocs()
  }

  const handleToggleStatus = async (doc: KnowledgeDocument) => {
    const newStatus = doc.status === 'published' ? 'draft' : 'published'
    handleSave({ id: doc.id, status: newStatus })
  }

  if (!session) {
    return <Login supabase={supabase} />
  }

  return (
    <div className="app">
      <header className="header">
        <h1>知识库管理</h1>
        <div className="user-info">
          <span>{session.user.email}</span>
          <button className="btn-text" onClick={() => supabase.auth.signOut()}>
            退出
          </button>
        </div>
      </header>

      <main className="main">
        <div className="toolbar">
          <button className="btn-primary" onClick={() => { setEditing(null); setShowEditor(true) }}>
            + 新建文档
          </button>
          <button className="btn" onClick={() => robotApi?.open()}>
            打开机器人
          </button>
          <button className="btn" onClick={loadDocs} disabled={loading}>
            {loading ? '刷新中...' : '刷新列表'}
          </button>
        </div>

        {showEditor && (
          <DocumentEditor
            doc={editing}
            onSave={handleSave}
            onCancel={() => { setShowEditor(false); setEditing(null) }}
          />
        )}

        <DocumentList
          docs={docs}
          onEdit={(doc) => { setEditing(doc); setShowEditor(true) }}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
        />
      </main>

      <footer className="footer">
        <p>机器人已加载知识库工具：search_knowledge / get_document_detail / list_categories</p>
        <p>右下角悬浮球可拖拽，点击展开对话，试试问"有哪些分类"</p>
      </footer>
    </div>
  )
}
