import { Module, OnModuleInit } from '@nestjs/common'
import { ToolsService } from '../../tools/tools.service'
import { KNOWLEDGE_TOOLS } from './knowledge.tools'
import { KnowledgeService } from './knowledge.service'
import { KnowledgeController } from './knowledge.controller'

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
})
export class KnowledgeToolsModule implements OnModuleInit {
  constructor(private tools: ToolsService) {}

  onModuleInit() {
    this.tools.registerMany(KNOWLEDGE_TOOLS)
  }
}
