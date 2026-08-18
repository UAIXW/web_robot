import { Controller, Post, Body, Res, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiBody, ApiResponse } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { SupabaseJwtGuard, type ChatUser } from '../auth/supabase-jwt.guard'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { ChatService } from './chat.service'
import { ChatDto } from './chat.dto'

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(SupabaseJwtGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @ApiBody({ type: ChatDto })
  @ApiResponse({ status: 200, description: 'SSE 流式响应，事件序：tool_call → tool_result → delta → done' })
  @ApiResponse({ status: 401, description: 'JWT 无效或缺失' })
  @ApiResponse({ status: 429, description: '频率超限（20 次/分钟）' })
  async chat(
    @Body() dto: ChatDto,
    @CurrentUser() user: ChatUser,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    await this.chatService.checkLimit(user.uid)

    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000)

    // 客户端断开连接时中止上游 LLM 调用，避免空转与 busy 标记滞留
    const ac = new AbortController()
    const onClose = () => ac.abort()
    req.on('close', onClose)

    try {
      const result = await this.chatService.run(user, dto, send, ac.signal)
      send('done', result)
    } catch (e) {
      if (!ac.signal.aborted) {
        send('error', {
          code: 'chat_failed',
          message: e instanceof Error ? e.message : String(e),
        })
      }
    } finally {
      req.off('close', onClose)
      clearInterval(heartbeat)
      res.end()
    }
  }
}
