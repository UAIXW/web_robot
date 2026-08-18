import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

export interface LlmToolCall {
  id: string
  name: string
  args: string
}

export interface LlmStreamResult {
  content: string
  toolCalls: LlmToolCall[]
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name)
  private client: OpenAI | null = null
  private model: string

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('DEEPSEEK_API_KEY')
    this.model = config.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat'
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com',
      })
      // 仅在显式开启 DEEPSEEK_INSECURE_TLS=true 时关闭证书校验（仅限本机自签调试），
      // 默认保持 Node 的 TLS 校验开启，避免中间人攻击。
      if (config.get<string>('DEEPSEEK_INSECURE_TLS') === 'true') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
      }
    } else {
      this.logger.warn('DEEPSEEK_API_KEY 未配置，对话将使用 mock 模式')
    }
  }

  get available(): boolean {
    return this.client !== null
  }

  async streamChat(
    messages: unknown[],
    tools: unknown[],
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<LlmStreamResult> {
    if (!this.client) throw new Error('LLM 不可用')
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: messages as never,
        tools: (tools.length ? tools : undefined) as never,
        stream: true,
        temperature: 0.2,
      },
      { signal },
    )

    let content = ''
    const toolCalls: LlmToolCall[] = []

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta
      if (!delta) continue

      if (delta.content) {
        content += delta.content
        onDelta(delta.content)
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          let call = toolCalls[idx]
          if (!call) {
            call = { id: '', name: '', args: '' }
            toolCalls[idx] = call
          }
          if (tc.id) call.id = tc.id
          if (tc.function?.name) call.name = tc.function.name
          if (tc.function?.arguments) call.args += tc.function.arguments
        }
      }
    }

    return { content, toolCalls }
  }
}
