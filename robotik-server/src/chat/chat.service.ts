import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient } from '@supabase/supabase-js'
import type { ChatUser } from '../auth/supabase-jwt.guard'
import type { SiteConfig } from '../config/site-config.service'
import { LlmService } from '../llm/llm.service'
import { ToolsService, type ToolContext, type ToolResult, type RobotClient } from '../tools/tools.service'
import { SiteConfigService } from '../config/site-config.service'
import { RateLimitService } from '../infrastructure/rate-limit.service'
import { BusinessException } from '../shared/filters/business.exception'
import { ErrorCode } from '../shared/constants/error-codes'

export interface ChatRequest {
  app_id: string
  conversation_id?: string
  message: string
}

export type SendFn = (event: string, data: unknown) => void

interface HistoryRow {
  role: string
  content: string
}

interface MockPlan {
  tool: string
  args: Record<string, unknown>
}

const MAX_TOOL_ROUNDS = 5
const HISTORY_LIMIT = 20

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private config: ConfigService,
    private llm: LlmService,
    private tools: ToolsService,
    private sites: SiteConfigService,
    private rateLimit: RateLimitService,
  ) {}

  checkLimit(uid: string): Promise<void> {
    return this.rateLimit.hit(uid)
  }

  private userClient(jwt: string): RobotClient {
    return createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    ).schema('robotik')
  }

  async run(
    user: ChatUser,
    dto: ChatRequest,
    send: SendFn,
    signal?: AbortSignal,
  ): Promise<{ conversation_id: string }> {
    const acquired = await this.rateLimit.acquire(user.uid)
    if (!acquired) {
      throw new BusinessException(ErrorCode.CHAT_BUSY, HttpStatus.TOO_MANY_REQUESTS, '上一条消息还在处理中')
    }
    const startedAt = Date.now()
    let status = 'success'
    let errorMessage: string | null = null
    let toolCallCount = 0
    let convId = dto.conversation_id ?? null

    try {
      const result = await this.orchestrate(user, dto, send, (n) => { toolCallCount += n }, signal)
      convId = result.conversation_id
      return result
    } catch (e) {
      status = signal?.aborted ? 'aborted' : 'error'
      errorMessage = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      await this.rateLimit.release(user.uid)
      this.logUsage(user, dto, convId, startedAt, status, errorMessage, toolCallCount).catch(() => {})
    }
  }

  private async logUsage(
    user: ChatUser,
    dto: ChatRequest,
    convId: string | null,
    startedAt: number,
    status: string,
    errorMessage: string | null,
    toolCalls: number,
  ) {
    try {
      const client = this.userClient(user.jwt)
      const latency = Date.now() - startedAt
      const model = this.llm.available ? (this.config.get<string>('DEEPSEEK_MODEL') ?? 'deepseek') : 'mock'
      const { error } = await client.from('usage_logs').insert({
        app_id: dto.app_id,
        conversation_id: convId,
        user_id: user.uid,
        model,
        input_tokens: 0,
        output_tokens: 0,
        tool_calls: toolCalls,
        latency_ms: latency,
        status,
        error_message: errorMessage,
      })
      if (error) this.logger.warn(`usage_logs 写入失败: ${error.message}`)
    } catch (e) {
      this.logger.warn(`logUsage 异常: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  private async orchestrate(
    user: ChatUser,
    dto: ChatRequest,
    send: SendFn,
    countToolCalls: (n: number) => void,
    signal?: AbortSignal,
  ): Promise<{ conversation_id: string }> {
    const client = this.userClient(user.jwt)

    let convId = dto.conversation_id ?? null
    if (!convId) {
      const { data, error } = await client
        .from('conversations')
        .insert({ app_id: dto.app_id, user_id: user.uid, title: dto.message.slice(0, 50) })
        .select('id')
        .single()
      if (error || !data) throw new Error(`会话创建失败: ${error?.message ?? 'unknown'}`)
      convId = (data as { id: string }).id
    }

    const { data: histRaw } = await client
      .from('messages')
      .select('role,content')
      .eq('conversation_id', convId)
      .order('id', { ascending: false })
      .limit(HISTORY_LIMIT)
    const history = ((histRaw ?? []) as HistoryRow[])
      .reverse()
      .filter((m) => m.role === 'user' || m.role === 'assistant')

    const { error: insertErr } = await client
      .from('messages')
      .insert({ conversation_id: convId, role: 'user', content: dto.message })
    if (insertErr) this.logger.warn(`用户消息入库失败: ${insertErr.message}`)

    const siteCfg = await this.sites.get(dto.app_id)
    const allowed = siteCfg?.allowed_tools ?? null
    const ctx: ToolContext = {
      client,
      jwt: user.jwt,
      appId: dto.app_id,
      config: {
        supabaseUrl: this.config.get<string>('SUPABASE_URL'),
        supabaseAnonKey: this.config.get<string>('SUPABASE_ANON_KEY'),
      },
    }

    let answer = ''
    if (this.llm.available) {
      answer = await this.runLlmLoop(dto, convId, siteCfg, history, ctx, client, send, countToolCalls, signal)
    } else {
      answer = await this.runMock(dto, convId, allowed, ctx, client, send, countToolCalls)
    }

    if (!answer) answer = '抱歉，我暂时没能生成回答，换个说法试试？'
    await client.from('messages').insert({ conversation_id: convId, role: 'assistant', content: answer })
    return { conversation_id: convId }
  }

  private async runLlmLoop(
    dto: ChatRequest,
    convId: string,
    siteCfg: SiteConfig | null,
    history: HistoryRow[],
    ctx: ToolContext,
    client: RobotClient,
    send: SendFn,
    countToolCalls: (n: number) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const system = this.systemPrompt(dto.app_id, siteCfg)
    const msgs: unknown[] = [
      { role: 'system', content: system },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: dto.message },
    ]
    const openaiTools = this.tools.buildOpenAiTools(siteCfg?.allowed_tools ?? null, dto.app_id)

    let answer = ''
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const { content, toolCalls } = await this.llm.streamChat(msgs, openaiTools, (t) =>
        send('delta', { text: t }),
        signal,
      )
      if (!toolCalls.length) {
        answer = content
        break
      }
      msgs.push({
        role: 'assistant',
        content: content || '',
        tool_calls: toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: c.args },
        })),
      })
      countToolCalls(toolCalls.length)
      for (const call of toolCalls) {
        send('tool_call', { name: call.name, args: call.args })
        const result = await this.executeTool(call.name, call.args, ctx)
        send('tool_result', { name: call.name, ok: true, summary: result.text.slice(0, 120) })
        await this.persistToolMessage(client, convId, call.name, result)
        msgs.push({ role: 'tool', tool_call_id: call.id, content: result.text })
      }
      if (round === MAX_TOOL_ROUNDS - 1) {
        answer = '这个问题我尝试了多轮工具调用仍未完成，换个说法试试？'
      }
    }
    return answer
  }

  private async executeTool(
    name: string,
    argsJson: string,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    let args: Record<string, unknown> = {}
    try {
      args = argsJson ? JSON.parse(argsJson) : {}
    } catch {
      return { text: '工具参数不是合法 JSON，请重试。' }
    }
    try {
      return await this.tools.execute(name, ctx, args)
    } catch (e) {
      return { text: `工具执行失败：${e instanceof Error ? e.message : String(e)}` }
    }
  }

  private async persistToolMessage(
    client: RobotClient,
    convId: string,
    toolName: string,
    result: ToolResult,
  ) {
    const { error } = await client.from('messages').insert({
      conversation_id: convId,
      role: 'tool',
      content: result.text,
      tool_name: toolName,
    })
    if (error) this.logger.warn(`工具消息入库失败: ${error.message}`)
  }

  private async runMock(
    dto: ChatRequest,
    convId: string,
    allowed: string[] | null,
    ctx: ToolContext,
    client: RobotClient,
    send: SendFn,
    countToolCalls: (n: number) => void,
  ): Promise<string> {
    const plan = this.mockPlan(dto.message, dto.app_id)
    let answer: string
    if (!plan) {
      answer = dto.app_id === 'knowledge'
        ? '我目前是 mock 模式（后端未配置 DEEPSEEK_API_KEY），可以试试：搜索文档 / 查看分类 / 现在几点。'
        : '我目前是 mock 模式（后端未配置 DEEPSEEK_API_KEY），可以试试：现在几点 / echo 你好 / 计算 1+2。'
    } else if (!this.tools.isAllowed(plan.tool, allowed, dto.app_id)) {
      answer = `当前应用「${dto.app_id}」未开放该功能（工具白名单：${(allowed ?? []).join(', ') || '无'}）。`
    } else {
      countToolCalls(1)
      send('tool_call', { name: plan.tool, args: plan.args })
      const result = await this.tools.execute(plan.tool, ctx, plan.args)
      send('tool_result', { name: plan.tool, ok: true, summary: result.text.slice(0, 120) })
      await this.persistToolMessage(client, convId, plan.tool, result)
      answer = result.text
    }
    for (const seg of this.chunk(answer)) {
      send('delta', { text: seg })
      await this.sleep(25)
    }
    return answer
  }

  private mockPlan(text: string, appId: string): MockPlan | null {
    const t = text.trim()
    if (/(几点|时间|now|time)/i.test(t)) {
      return { tool: 'get_time', args: {} }
    }
    const echoMatch = t.match(/(?:echo|回显|复读)\s*(.+)/i)
    if (echoMatch) {
      return { tool: 'echo', args: { text: echoMatch[1].trim() } }
    }
    const calcMatch = t.match(/(?:计算|算一下|算|calculate)\s*([\d+\-*/().\s]+)/i)
    if (calcMatch) {
      return { tool: 'calculate', args: { expression: calcMatch[1].trim() } }
    }
    if (appId === 'knowledge') {
      if (/(分类|类别|category)/i.test(t)) {
        return { tool: 'list_categories', args: {} }
      }
      if (/(搜索|查找|查|search|find)/i.test(t)) {
        const m = t.match(/(?:搜索|查找|查|search|find)\s*(.+)/i)
        return { tool: 'search_knowledge', args: { query: m?.[1]?.trim() ?? t } }
      }
    }
    return null
  }

  private chunk(text: string, size = 14): string[] {
    const out: string[] = []
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
    return out
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms))
  }

  async listConversations(
    user: ChatUser,
    query: { app_id?: string; limit: number; offset: number },
  ) {
    const client = this.userClient(user.jwt)
    let q = client
      .from('conversations')
      .select('id, app_id, title, created_at')
      .eq('user_id', user.uid)
      .order('created_at', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1)
    if (query.app_id) q = q.eq('app_id', query.app_id)
    const { data, error, count } = await q
    if (error) throw new Error(`查询会话列表失败: ${error.message}`)
    return { items: data ?? [], total: count ?? 0, limit: query.limit, offset: query.offset }
  }

  async listMessages(user: ChatUser, conversationId: string) {
    const client = this.userClient(user.jwt)
    const { data: conv } = await client
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.uid)
      .single()
    if (!conv) throw new BusinessException(ErrorCode.CONVERSATION_NOT_FOUND, HttpStatus.NOT_FOUND)

    const { data, error } = await client
      .from('messages')
      .select('id, role, content, tool_name, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(`查询消息历史失败: ${error.message}`)
    return { items: data ?? [] }
  }

  private systemPrompt(appId: string, siteCfg: SiteConfig | null): string {
    const allowed = siteCfg?.allowed_tools ?? null
    const toolList = this.tools
      .list(allowed, appId)
      .map((t) => `${t.name}: ${t.description}`)
      .join('\n')
    return [
      `你是「${siteCfg?.robot_name ?? '小助手'}」，嵌入在应用「${appId}」中的悬浮助手。`,
      '用中文、简洁友好地回答；需要外部数据时必须调用工具，一切以工具返回为准，绝不编造数据。',
      toolList ? `可用工具：\n${toolList}` : '当前没有可用工具，请直接基于对话回答。',
    ].join('\n')
  }
}
