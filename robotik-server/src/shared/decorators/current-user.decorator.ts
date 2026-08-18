import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { ChatUser } from '../../auth/supabase-jwt.guard'

export const CurrentUser = createParamDecorator(
  (data: keyof ChatUser | undefined, ctx: ExecutionContext): ChatUser | unknown => {
    const req = ctx.switchToHttp().getRequest()
    const user = req.user as ChatUser | undefined
    if (!user) return undefined
    return data ? user[data] : user
  },
)
