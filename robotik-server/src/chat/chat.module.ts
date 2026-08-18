import { Module } from '@nestjs/common'
import { ChatController } from './chat.controller'
import { ConversationController } from './conversation.controller'
import { ChatService } from './chat.service'

@Module({
  controllers: [ChatController, ConversationController],
  providers: [ChatService],
})
export class ChatModule {}
