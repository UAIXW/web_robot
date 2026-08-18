import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { map, Observable } from 'rxjs'

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest()
    if (req.res?.getHeader('Content-Type')?.includes('text/event-stream')) {
      return next.handle()
    }
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        data,
        message: 'success',
        timestamp: new Date().toISOString(),
      })),
    )
  }
}
