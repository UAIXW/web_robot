import { Injectable } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { ConfigService } from '@nestjs/config'
import type { RobotClient } from '../../tools/tools.service'

export interface KnowledgeDocument {
  id: string
  app_id: string
  title: string
  content: string
  category: string
  status: string
  created_by: string | null
  created_at: string
  updated_at: string
}

@Injectable()
export class KnowledgeService {
  private supabaseUrl: string
  private supabaseAnonKey: string

  constructor(config: ConfigService) {
    this.supabaseUrl = config.get<string>('SUPABASE_URL')!
    this.supabaseAnonKey = config.get<string>('SUPABASE_ANON_KEY')!
  }

  /**
   * 以请求用户的 JWT 透传 Supabase，交由 knowledge schema 的 RLS 兜底：
   * - 所有登录用户可读 status='published' 的文档
   * - 仅 robotik.is_admin() 可写（增删改）及读取草稿
   * 后端自身不再持有 service_role 能力，符合 D3 决策。
   */
  private client(jwt: string): RobotClient {
    return createClient(this.supabaseUrl, this.supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }).schema('knowledge')
  }

  async list(jwt: string): Promise<KnowledgeDocument[]> {
    const { data, error } = await this.client(jwt)
      .from('documents')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) throw new Error(`查询失败: ${error.message}`)
    return (data ?? []) as KnowledgeDocument[]
  }

  async get(jwt: string, id: string): Promise<KnowledgeDocument | null> {
    const { data, error } = await this.client(jwt)
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`查询失败: ${error.message}`)
    return data as KnowledgeDocument | null
  }

  async create(
    jwt: string,
    userId: string,
    dto: {
      title: string
      content?: string
      category?: string
      status?: string
    },
  ): Promise<KnowledgeDocument> {
    const { data, error } = await this.client(jwt)
      .from('documents')
      .insert({
        title: dto.title,
        content: dto.content ?? '',
        category: dto.category ?? '通用',
        status: dto.status ?? 'draft',
        created_by: userId,
      })
      .select('*')
      .single()
    if (error) throw new Error(`创建失败: ${error.message}`)
    return data as KnowledgeDocument
  }

  async update(
    jwt: string,
    id: string,
    dto: Partial<{
      title: string
      content: string
      category: string
      status: string
    }>,
  ): Promise<KnowledgeDocument | null> {
    const { data, error } = await this.client(jwt)
      .from('documents')
      .update(dto)
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) throw new Error(`更新失败: ${error.message}`)
    return data as KnowledgeDocument | null
  }

  async delete(jwt: string, id: string): Promise<void> {
    const { error } = await this.client(jwt)
      .from('documents')
      .delete()
      .eq('id', id)
    if (error) throw new Error(`删除失败: ${error.message}`)
  }
}
