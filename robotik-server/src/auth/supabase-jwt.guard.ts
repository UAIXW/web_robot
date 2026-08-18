import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { BusinessException } from '../shared/filters/business.exception'
import { ErrorCode } from '../shared/constants/error-codes'

export interface ChatUser {
  uid: string
  email: string
  jwt: string
}

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private jwks: ReturnType<typeof createRemoteJWKSet>

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL')!
    this.jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`))
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest()
    const header: string | undefined = req.headers.authorization
    if (!header?.startsWith('Bearer ')) throw new BusinessException(ErrorCode.AUTH_MISSING, 401, '缺少 Bearer token')
    const token = header.slice(7)
    try {
      const { payload } = await jwtVerify(token, this.jwks)
      req.user = {
        uid: payload.sub!,
        email: (payload as { email?: string }).email ?? '',
        jwt: token,
      }
      return true
    } catch {
      throw new BusinessException(ErrorCode.AUTH_INVALID_TOKEN, 401, 'token 无效或已过期')
    }
  }
}
