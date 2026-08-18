import { IsOptional, IsString, IsUUID, Length } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ChatDto {
  @ApiProperty({ example: 'default', description: '应用 ID，对应 site_configs.app_id' })
  @IsString()
  @Length(1, 64)
  app_id: string

  @ApiPropertyOptional({ example: 'd82f4f90-1afa-4fd4-ade2-95dec18264a4', description: '会话 ID，不传则新建会话' })
  @IsOptional()
  @IsUUID()
  conversation_id?: string

  @ApiProperty({ example: '我有多少积分', description: '用户消息', maxLength: 200 })
  @IsString()
  @Length(1, 200)
  message: string
}
