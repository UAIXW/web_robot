import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { ErrorCode, ErrorCodeMessage } from '../constants/error-codes'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const excRes = exception instanceof HttpException ? (exception.getResponse() as any) : null

    const errorCode = excRes?.errorCode ?? ErrorCode.INTERNAL_ERROR
    const message =
      excRes?.message ??
      (exception instanceof Error ? exception.message : ErrorCodeMessage[ErrorCode.INTERNAL_ERROR])

    this.logger.error(`${req.method} ${req.url} ${status} - ${errorCode}: ${message}`)

    if (res && !res.headersSent) {
      res.status(status).json({
        code: status >= 400 ? 1 : 0,
        errorCode,
        message: typeof message === 'string' ? message : JSON.stringify(message),
        timestamp: new Date().toISOString(),
        path: req.url,
      })
    }
  }
}
