import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SupabaseJwtGuard, type ChatUser } from '../../auth/supabase-jwt.guard'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { KnowledgeService } from './knowledge.service'
import { CreateDocumentDto, UpdateDocumentDto } from './dto'

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller('knowledge/documents')
@UseGuards(SupabaseJwtGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @ApiOperation({ summary: '文档列表' })
  async list(@CurrentUser() user: ChatUser) {
    return this.knowledgeService.list(user.jwt)
  }

  @Get(':id')
  @ApiOperation({ summary: '文档详情' })
  async get(@CurrentUser() user: ChatUser, @Param('id') id: string) {
    return this.knowledgeService.get(user.jwt, id)
  }

  @Post()
  @ApiOperation({ summary: '创建文档（仅管理员）' })
  async create(@CurrentUser() user: ChatUser, @Body() dto: CreateDocumentDto) {
    return this.knowledgeService.create(user.jwt, user.uid, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新文档（仅管理员）' })
  async update(@CurrentUser() user: ChatUser, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.knowledgeService.update(user.jwt, id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文档（仅管理员）' })
  async delete(@CurrentUser() user: ChatUser, @Param('id') id: string) {
    await this.knowledgeService.delete(user.jwt, id)
    return { success: true }
  }
}
