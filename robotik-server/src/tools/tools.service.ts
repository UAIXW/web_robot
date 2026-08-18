import { Injectable, Logger } from '@nestjs/common'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RobotClient = ReturnType<SupabaseClient['schema']>

export interface ToolContext {
  client: RobotClient
  jwt: string
  appId: string
  config: Record<string, unknown>
}

export interface ToolResult {
  text: string
  data?: unknown
}

export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  appId?: string
  execute(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult>
}

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name)
  private tools = new Map<string, ToolDef>()

  register(tool: ToolDef) {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`工具 "${tool.name}" 已注册，覆盖旧定义`)
    }
    this.tools.set(tool.name, tool)
    this.logger.debug(`已注册工具: ${tool.name}${tool.appId ? ` (appId=${tool.appId})` : ' (通用)'}`)
  }

  registerMany(tools: ToolDef[]) {
    for (const t of tools) this.register(t)
  }

  list(allowed?: string[] | null, appId?: string): ToolDef[] {
    let tools = [...this.tools.values()]
    tools = tools.filter((t) => !t.appId || t.appId === appId)
    if (Array.isArray(allowed) && allowed.length > 0) {
      const set = new Set(allowed)
      tools = tools.filter((t) => set.has(t.name))
    }
    return tools
  }

  buildOpenAiTools(allowed?: string[] | null, appId?: string) {
    return this.list(allowed, appId).map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
  }

  isAllowed(name: string, allowed?: string[] | null, appId?: string): boolean {
    return this.list(allowed, appId).some((t) => t.name === name)
  }

  async execute(name: string, ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) return { text: `未注册的工具：${name}` }
    if (tool.appId && tool.appId !== ctx.appId) {
      return { text: `工具 "${name}" 不适用于当前应用` }
    }
    return tool.execute(ctx, args)
  }
}
