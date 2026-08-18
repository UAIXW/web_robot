import { createClient } from '@supabase/supabase-js'
import type { ToolDef, RobotClient } from '../../tools/tools.service'

function knowledgeClient(jwt: string, url: string, key: string): RobotClient {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }).schema('knowledge')
}

interface KnowledgeDoc {
  id: string
  title: string
  content: string
  category: string
  status: string
}

export const KNOWLEDGE_TOOLS: ToolDef[] = [
  {
    name: 'search_knowledge',
    description: '在知识库中搜索文档，支持全文检索和按分类过滤',
    appId: 'knowledge',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        category: { type: 'string', description: '可选，按分类过滤' },
      },
      required: ['query'],
    },
    async execute(ctx, args) {
      const url = ctx.config.supabaseUrl as string
      const key = ctx.config.supabaseAnonKey as string
      if (!url || !key) return { text: '知识库未配置。' }
      const kc = knowledgeClient(ctx.jwt, url, key)
      const query = String(args.query ?? '').trim()
      const category = args.category ? String(args.category) : null
      let q = kc
        .from('documents')
        .select('id,title,category,status')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(10)
      if (category) q = q.eq('category', category)
      const { data, error } = await q
      if (error) return { text: `知识库检索失败：${error.message}` }
      const rows = (data ?? []) as KnowledgeDoc[]
      if (!rows.length) return { text: `没有找到与「${query}」相关的文档。`, data: { docs: [] } }
      const text =
        `找到 ${rows.length} 篇相关文档：\n` +
        rows.map((d) => `· ${d.title}（${d.category}）— ID: ${d.id}`).join('\n')
      return { text, data: { docs: rows } }
    },
  },
  {
    name: 'get_document_detail',
    description: '根据文档 ID 获取完整内容',
    appId: 'knowledge',
    parameters: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: '文档 ID' },
      },
      required: ['document_id'],
    },
    async execute(ctx, args) {
      const url = ctx.config.supabaseUrl as string
      const key = ctx.config.supabaseAnonKey as string
      if (!url || !key) return { text: '知识库未配置。' }
      const kc = knowledgeClient(ctx.jwt, url, key)
      const docId = String(args.document_id ?? '').trim()
      if (!docId) return { text: '请提供文档 ID。' }
      const { data, error } = await kc
        .from('documents')
        .select('id,title,content,category,status,updated_at')
        .eq('id', docId)
        .maybeSingle()
      if (error) return { text: `文档查询失败：${error.message}` }
      const doc = data as KnowledgeDoc | null
      if (!doc) return { text: `没有找到 ID 为 ${docId} 的文档。` }
      const text = `《${doc.title}》\n分类：${doc.category}\n\n${doc.content}`
      return { text, data: { doc } }
    },
  },
  {
    name: 'list_categories',
    description: '列出知识库中所有文档分类',
    appId: 'knowledge',
    parameters: { type: 'object', properties: {}, required: [] },
    async execute(ctx) {
      const url = ctx.config.supabaseUrl as string
      const key = ctx.config.supabaseAnonKey as string
      if (!url || !key) return { text: '知识库未配置。' }
      const kc = knowledgeClient(ctx.jwt, url, key)
      const { data, error } = await kc
        .from('documents')
        .select('category')
        .eq('status', 'published')
      if (error) return { text: `分类查询失败：${error.message}` }
      const rows = (data ?? []) as Pick<KnowledgeDoc, 'category'>[]
      const cats = [...new Set(rows.map((r) => r.category))]
      if (!cats.length) return { text: '知识库暂时没有分类。', data: { categories: [] } }
      const text = `知识库有以下分类：\n${cats.map((c) => `· ${c}`).join('\n')}`
      return { text, data: { categories: cats } }
    },
  },
]
