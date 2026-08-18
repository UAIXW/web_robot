import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger'
import { SupabaseJwtGuard, type ChatUser } from '../auth/supabase-jwt.guard'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { ChatService } from './chat.service'
import { ConversationQueryDto } from './conversation.dto'

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(SupabaseJwtGuard)
export class ConversationController {
  constructor(private chatService: ChatService) {}

  @Get()
  @ApiQuery({ name: 'app_id', required: false, description: '按应用过滤' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '每页条数（默认 20）' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: '偏移量（默认 0）' })
  @ApiResponse({ status: 200, description: '会话列表（按创建时间倒序）' })
  @ApiResponse({ status: 401, description: 'JWT 无效或缺失' })
  async list(
    @Query() query: ConversationQueryDto,
    @CurrentUser() user: ChatUser,
  ) {
    return this.chatService.listConversations(user, {
      app_id: query.app_id,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Get(':id/messages')
  @ApiResponse({ status: 200, description: '消息历史（按时间正序）' })
  @ApiResponse({ status: 401, description: 'JWT 无效或缺失' })
  @ApiResponse({ status: 404, description: '会话不存在或无权访问' })
  async messages(
    @Param('id') id: string,
    @CurrentUser() user: ChatUser,
  ) {
    return this.chatService.listMessages(user, id)
  }
}
