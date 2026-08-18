import { Global, Module } from '@nestjs/common'
import { LlmService } from '../llm/llm.service'
import { ToolsService } from '../tools/tools.service'
import { SiteConfigService } from '../config/site-config.service'
import { RateLimitService } from './rate-limit.service'
import { SupabaseJwtGuard } from '../auth/supabase-jwt.guard'

@Global()
@Module({
  providers: [LlmService, ToolsService, SiteConfigService, RateLimitService, SupabaseJwtGuard],
  exports: [LlmService, ToolsService, SiteConfigService, RateLimitService, SupabaseJwtGuard],
})
export class InfrastructureModule {}
