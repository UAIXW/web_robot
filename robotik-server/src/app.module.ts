import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InfrastructureModule } from './infrastructure/infrastructure.module'
import { BuiltinToolsModule } from './tools/builtin/builtin.module'
import { KnowledgeToolsModule } from './apps/knowledge/knowledge.module'
import { ChatModule } from './chat/chat.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: join(__dirname, '..', '.env') }),
    InfrastructureModule,
    BuiltinToolsModule,
    KnowledgeToolsModule,
    ChatModule,
  ],
})
export class AppModule {}
