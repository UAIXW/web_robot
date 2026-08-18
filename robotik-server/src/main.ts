import 'reflect-metadata'
import { execSync } from 'node:child_process'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { TransformInterceptor } from './shared/interceptors/transform.interceptor'
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter'

const logger = new Logger('Bootstrap')

function killPortOccupant(port: number): void {
  try {
    const pid = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: 'utf-8' }).trim()
    if (pid) {
      logger.warn(`端口 ${port} 被旧进程 PID ${pid} 占用，正在清理...`)
      execSync(`kill -9 ${pid} 2>/dev/null`)
      logger.log(`已终止旧进程 PID ${pid}`)
    }
  } catch {
    // lsof 无输出时 execSync 会抛错，忽略即可
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('v1')
  app.enableCors({ origin: true })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  app.useGlobalInterceptors(new TransformInterceptor())
  app.useGlobalFilters(new AllExceptionsFilter())

  const config = new DocumentBuilder()
    .setTitle('Robotik API')
    .setDescription('悬浮机器人对话后端：JWT 验签 + 工具调用循环 + SSE 流式响应')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  const port = Number(process.env.PORT) || 8787
  const mode = process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'mock'

  try {
    await app.listen(port)
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
      logger.warn(`端口 ${port} 已占用，尝试清理旧进程后重试...`)
      killPortOccupant(port)
      await new Promise((r) => setTimeout(r, 500))
      await app.listen(port)
    } else {
      throw err
    }
  }

  logger.log(`listening on http://localhost:${port}/v1/chat (llm: ${mode})`)
  logger.log(`swagger  http://localhost:${port}/docs`)
}

bootstrap()
