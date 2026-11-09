/* ------------------------------------------------------------------ */
/* 受控网关：平台无关的请求处理。                                        */
/* 云函数入口只需把平台事件转成 GatewayRequest、把 GatewayResponse 写回。 */
/* 全部依赖通过接口注入，本地用 mock 实现即可完整测试，不依赖真实凭据。   */
/* ------------------------------------------------------------------ */

import type { PublishResult } from "../site/admin/data/adapter"
import type { SnapshotEnvelope } from "../site/admin/data/snapshot"
import {
  createMemoryRateLimiter,
  type RateLimiter,
  type RateLimitRule,
} from "./rate-limit.ts"
import { createKeyedMutex } from "./publish-guard.ts"

/* ---------------- 依赖接口 ---------------- */

export interface FeishuUser {
  name: string
  avatarUrl: string
  openId: string
}

export interface FeishuClient {
  exchangeCode(code: string): Promise<{ accessToken: string; user: FeishuUser }>
}

export interface SessionPayload {
  openId: string
  name: string
  avatarUrl: string
  createdAt: number
  expiresAt: number
}

export interface SessionStore {
  create(payload: SessionPayload): Promise<string>
  get(sid: string): Promise<SessionPayload | null>
  destroy(sid: string): Promise<void>
}

export interface PublishService {
  publish(draft: unknown, operator: SessionPayload): Promise<PublishResult>
}

export interface SnapshotService {
  current(): Promise<SnapshotEnvelope>
}

export interface GatewayDeps {
  feishu: FeishuClient
  sessions: SessionStore
  publisher: PublishService
  snapshots: SnapshotService
  adminOpenIds: readonly string[]
  sessionTtlMs: number
  /** 限流实现；不传则用进程内固定窗口计数（单实例场景） */
  rateLimiter?: RateLimiter
  /** 按路由覆盖默认限流规则 */
  rateRules?: Partial<RateLimitRules>
}

export interface RateLimitRules {
  exchange: RateLimitRule
  publish: RateLimitRule
}

/** 默认规则：登录 10 次/分/IP；发布 3 次/分/管理员。 */
export const DEFAULT_RATE_RULES: RateLimitRules = {
  exchange: { limit: 10, windowMs: 60_000 },
  publish: { limit: 3, windowMs: 60_000 },
}

/* ---------------- 请求/响应 ---------------- */

export interface GatewayRequest {
  method: string
  url: string
  headers: Record<string, string>
  bodyText: string
}

export interface GatewayResponse {
  status: number
  headers: Record<string, string>
  body: string
}

const SESSION_COOKIE = "sid"

function json(
  status: number,
  data: unknown,
  extra?: Record<string, string>,
): GatewayResponse {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(extra ?? {}),
    },
    body: JSON.stringify(data),
  }
}

function error(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, string>,
): GatewayResponse {
  return json(status, { error: { code, message } }, extra)
}

/** 取客户端 IP：优先反向代理头，缺失时退化为 unknown（单实例仍可限流）。 */
function clientIp(headers: Record<string, string>): string {
  const forwarded = headers["x-forwarded-for"]
  if (forwarded) return forwarded.split(",")[0].trim()
  return headers["x-real-ip"] ?? headers["cf-connecting-ip"] ?? "unknown"
}

function tooMany(retryAfterMs: number): GatewayResponse {
  const seconds = String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
  return error(429, "RATE_LIMITED", "请求过于频繁，请稍后再试", {
    "retry-after": seconds,
  })
}

function pathOf(url: string): string {
  return url.split("?")[0]
}

function parseCookies(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=")
    if (i > 0) {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
    }
  }
  return out
}

function parseBody(bodyText: string): Record<string, unknown> | null {
  if (!bodyText) return {}
  try {
    const v = JSON.parse(bodyText)
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function maskOpenId(openId: string): string {
  return openId.length <= 4 ? openId : `…${openId.slice(-4)}`
}

type AuthResult =
  | { ok: true; session: SessionPayload; sid: string }
  | { ok: false; response: GatewayResponse }

async function authenticate(
  deps: GatewayDeps,
  req: GatewayRequest,
): Promise<AuthResult> {
  const sid = parseCookies(req.headers)[SESSION_COOKIE]
  if (!sid) {
    return { ok: false, response: error(401, "AUTH_REQUIRED", "请先登录") }
  }
  const session = await deps.sessions.get(sid)
  if (!session) {
    return { ok: false, response: error(401, "AUTH_REQUIRED", "会话不存在或已过期") }
  }
  if (session.expiresAt <= Date.now()) {
    await deps.sessions.destroy(sid)
    return { ok: false, response: error(401, "AUTH_REQUIRED", "会话已过期") }
  }
  if (!deps.adminOpenIds.includes(session.openId)) {
    return { ok: false, response: error(403, "NOT_ALLOWED", "账号不在管理员白名单") }
  }
  return { ok: true, session, sid }
}

/* ---------------- 网关工厂 ---------------- */

export function createGateway(deps: GatewayDeps) {
  const limiter = deps.rateLimiter ?? createMemoryRateLimiter()
  const rules: RateLimitRules = { ...DEFAULT_RATE_RULES, ...(deps.rateRules ?? {}) }
  // 单实例内串行发布：避免两个请求交叉写表 / 切快照指针。
  const publishLock = createKeyedMutex()
  const startedAt = Date.now()
  const stats = { total: 0, byStatus: {} as Record<string, number> }

  async function handle(req: GatewayRequest): Promise<GatewayResponse> {
    const path = pathOf(req.url)
    const method = req.method.toUpperCase()

    /* GET /api/health：给压测与看板用的轻量健康/计数端点（不含敏感信息） */
    if (path === "/api/health" && method === "GET") {
      return json(200, {
        ok: true,
        uptimeMs: Date.now() - startedAt,
        requests: { total: stats.total, byStatus: stats.byStatus },
      })
    }

    /* POST /api/auth/exchange */
    if (path === "/api/auth/exchange" && method === "POST") {
      // 未登录也能打这个端点，所以按 IP 限制，先于解析请求体。
      const gate = limiter.hit(`exchange:${clientIp(req.headers)}`, rules.exchange)
      if (!gate.allowed) return tooMany(gate.retryAfterMs)
      const body = parseBody(req.bodyText)
      if (!body) return error(400, "BAD_REQUEST", "请求体不是合法 JSON")
      if (typeof body.code !== "string" || !body.code) {
        return error(400, "BAD_REQUEST", "缺少 code")
      }
      try {
        const { user } = await deps.feishu.exchangeCode(body.code)
        if (!deps.adminOpenIds.includes(user.openId)) {
          return error(403, "NOT_ALLOWED", "该账号不在管理员白名单")
        }
        const now = Date.now()
        const expiresAt = now + deps.sessionTtlMs
        const sid = await deps.sessions.create({
          openId: user.openId,
          name: user.name,
          avatarUrl: user.avatarUrl,
          createdAt: now,
          expiresAt,
        })
        return json(
          200,
          {
            name: user.name,
            avatarUrl: user.avatarUrl,
            openIdSuffix: maskOpenId(user.openId),
            expiresAt,
          },
          {
            "set-cookie":
              `${SESSION_COOKIE}=${encodeURIComponent(sid)}; ` +
              "HttpOnly; Secure; SameSite=Lax; Path=/",
          },
        )
      } catch (e) {
        return error(
          502,
          "UPSTREAM_FAILED",
          "飞书授权失败：" + (e instanceof Error ? e.message : "未知错误"),
        )
      }
    }

    /* GET /api/auth/me */
    if (path === "/api/auth/me" && method === "GET") {
      const auth = await authenticate(deps, req)
      if (!auth.ok) return auth.response
      return json(200, {
        name: auth.session.name,
        avatarUrl: auth.session.avatarUrl,
        openIdSuffix: maskOpenId(auth.session.openId),
        expiresAt: auth.session.expiresAt,
      })
    }

    /* POST /api/auth/logout */
    if (path === "/api/auth/logout" && method === "POST") {
      const sid = parseCookies(req.headers)[SESSION_COOKIE]
      if (sid) await deps.sessions.destroy(sid)
      return json(
        200,
        { ok: true },
        {
          "set-cookie":
            `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
        },
      )
    }

    /* POST /api/publish */
    if (path === "/api/publish" && method === "POST") {
      const body = parseBody(req.bodyText)
      if (!body) return error(400, "BAD_REQUEST", "请求体不是合法 JSON")
      const auth = await authenticate(deps, req)
      if (!auth.ok) return auth.response
      // 发布按管理员账号限制，避免同一账号的两台设备互相刷。
      const gate = limiter.hit(`publish:${auth.session.openId}`, rules.publish)
      if (!gate.allowed) return tooMany(gate.retryAfterMs)
      if (!body.draft || typeof body.draft !== "object") {
        return error(400, "BAD_REQUEST", "缺少 draft")
      }
      const result = await publishLock("publish", () =>
        deps.publisher.publish(body.draft, auth.session),
      )
      return json(result.status === "ok" ? 200 : 207, result)
    }

    /* GET /api/snapshot/current */
    if (path === "/api/snapshot/current" && method === "GET") {
      try {
        return json(200, await deps.snapshots.current())
      } catch {
        return error(404, "SNAP_MISSING", "当前快照不可用")
      }
    }

    return error(404, "NOT_FOUND", "未知端点")
  }

  return async function gateway(req: GatewayRequest): Promise<GatewayResponse> {
    const response = await handle(req)
    stats.total += 1
    const key = String(response.status)
    stats.byStatus[key] = (stats.byStatus[key] ?? 0) + 1
    return response
  }
}
