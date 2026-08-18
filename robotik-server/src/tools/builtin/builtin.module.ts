import { Module, OnModuleInit } from '@nestjs/common'
import { ToolsService } from '../tools.service'
import { BUILTIN_TOOLS } from './index'

// 注意：ToolsService 由 @Global() InfrastructureModule 提供并导出，
// 这里不得再声明 providers: [ToolsService]，否则会创建新的模块级实例，
// 导致内置工具注册进无人使用的私有实例（ChatService 注入的是全局实例）。
@Module({})
export class BuiltinToolsModule implements OnModuleInit {
  constructor(private tools: ToolsService) {}

  onModuleInit() {
    this.tools.registerMany(BUILTIN_TOOLS)
  }
}
