import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from '@supabase/supabase-js'
import type { RobotClient } from '../tools/tools.service'

export interface SiteConfig {
  robot_name: string | null
  welcome_text: string | null
  allowed_tools: string[] | null
  is_active: boolean
}

@Injectable()
export class SiteConfigService {
  private readonly logger = new Logger(SiteConfigService.name)
  private client: RobotClient
  private cache = new Map<string, { at: number; cfg: SiteConfig | null }>()
  private ttlMs = 30_000

  constructor(config: ConfigService) {
    this.client = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_ANON_KEY')!,
      { auth: { persistSession: false } },
    ).schema('robotik')
  }

  async get(appId: string): Promise<SiteConfig | null> {
    const hit = this.cache.get(appId)
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.cfg
    const { data, error } = await this.client
      .from('site_configs')
      .select('robot_name,welcome_text,allowed_tools,is_active')
      .eq('app_id', appId)
      .maybeSingle()
    if (error) {
      this.logger.warn(`site_configs 读取失败: ${error.message}`)
      this.cache.set(appId, { at: Date.now(), cfg: null })
      return null
    }
    const cfg = (data as SiteConfig | null) ?? null
    this.cache.set(appId, { at: Date.now(), cfg })
    return cfg
  }

  invalidate(appId?: string) {
    if (appId) this.cache.delete(appId)
    else this.cache.clear()
  }
}
