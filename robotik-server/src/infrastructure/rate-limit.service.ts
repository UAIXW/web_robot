import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { BusinessException } from '../shared/filters/business.exception'
import { ErrorCode } from '../shared/constants/error-codes'

const RATE_LIMIT_MAX = 20
const RATE_WINDOW_MS = 60_000
const BUSY_TTL_SECONDS = 60

/**
 * 可插拔限流/并发锁：
 * - 配置 REDIS_URL 时使用 Redis（支持多实例共享计数与互斥锁）
 * - 未配置或 Redis 故障时回退为进程内存实现（单实例）
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name)
  private readonly redis: Redis | null = null

  // 内存回退态（单实例）
  private busy = new Set<string>()
  private hits = new Map<string, number[]>()

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL')
    if (url) {
      this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 })
      this.redis.on('error', (e) =>
        this.logger.warn(`Redis 连接异常，限流降级为内存实现: ${e.message}`),
      )
    }
  }

  private busyKey(uid: string): string {
    return `robotik:busy:${uid}`
  }

  private rateKey(uid: string): string {
    return `robotik:rate:${uid}`
  }

  /** 获取并发锁，返回 false 表示该用户已有消息在处理中 */
  async acquire(uid: string): Promise<boolean> {
    if (this.redis) {
      try {
        const ok = await this.redis.set(this.busyKey(uid), '1', 'EX', BUSY_TTL_SECONDS, 'NX')
        return ok === 'OK'
      } catch (e) {
        this.logger.warn(`Redis acquire 失败，回退内存: ${(e as Error).message}`)
      }
    }
    if (this.busy.has(uid)) return false
    this.busy.add(uid)
    return true
  }

  /** 释放并发锁 */
  async release(uid: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(this.busyKey(uid))
        return
      } catch (e) {
        this.logger.warn(`Redis release 失败: ${(e as Error).message}`)
      }
    }
    this.busy.delete(uid)
  }

  /** 记录一次请求并检查频率，超限抛出 429 */
  async hit(uid: string): Promise<void> {
    if (this.redis) {
      try {
        const count = await this.redis.incr(this.rateKey(uid))
        if (count === 1) await this.redis.expire(this.rateKey(uid), Math.ceil(RATE_WINDOW_MS / 1000))
        if (count > RATE_LIMIT_MAX) {
          throw new BusinessException(
            ErrorCode.RATE_LIMIT,
            HttpStatus.TOO_MANY_REQUESTS,
            '请求太频繁，请稍后再试',
          )
        }
        return
      } catch (e) {
        if (e instanceof BusinessException) throw e
        this.logger.warn(`Redis hit 失败，回退内存: ${(e as Error).message}`)
      }
    }

    const now = Date.now()
    const arr = (this.hits.get(uid) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
    if (arr.length >= RATE_LIMIT_MAX) {
      this.hits.set(uid, arr)
      throw new BusinessException(
        ErrorCode.RATE_LIMIT,
        HttpStatus.TOO_MANY_REQUESTS,
        '请求太频繁，请稍后再试',
      )
    }
    arr.push(now)
    this.hits.set(uid, arr)
  }
}
