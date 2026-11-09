/* ------------------------------------------------------------------ */
/* 网关限流：固定窗口计数，默认进程内实现。                              */
/*                                                                    */
/* 用途：登录换 token 与发布是管理面仅有的两个可被刷的入口；           */
/* 限制按「IP / open_id + 路由」计数，避免一个脚本把飞书配额打满。      */
/*                                                                    */
/* 说明：进程内计数只在单实例内准确。多实例部署时，应把同一规则下放    */
/* 到 API 网关 / WAF（按 IP 的 CC 防护），本实现仍作为最后一道兜底。    */
/* ------------------------------------------------------------------ */

export interface RateLimitRule {
  /** 窗口内允许的次数 */
  limit: number
  /** 窗口长度（毫秒） */
  windowMs: number
}

export interface RateLimitDecision {
  allowed: boolean
  remaining: number
  /** 被拒时建议等待的毫秒数 */
  retryAfterMs: number
}

export interface RateLimiter {
  hit(key: string, rule: RateLimitRule, now?: number): RateLimitDecision
}

interface Bucket {
  count: number
  resetAt: number
}

export interface MemoryRateLimiterOptions {
  /** 最多保留多少个 key，超出时清理已过期项；默认 5000 */
  maxKeys?: number
}

export function createMemoryRateLimiter(
  opts: MemoryRateLimiterOptions = {},
): RateLimiter {
  const maxKeys = opts.maxKeys ?? 5000
  const buckets = new Map<string, Bucket>()

  function sweep(now: number): void {
    if (buckets.size <= maxKeys) return
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }

  return {
    hit(key, rule, now = Date.now()): RateLimitDecision {
      const current = buckets.get(key)
      if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + rule.windowMs })
        sweep(now)
        return {
          allowed: true,
          remaining: Math.max(0, rule.limit - 1),
          retryAfterMs: 0,
        }
      }
      if (current.count >= rule.limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(1, current.resetAt - now),
        }
      }
      current.count += 1
      return {
        allowed: true,
        remaining: Math.max(0, rule.limit - current.count),
        retryAfterMs: 0,
      }
    },
  }
}
