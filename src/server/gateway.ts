/* ------------------------------------------------------------------ */
/* 受控网关：平台无关的请求处理。                                        */
/* 云函数入口只需把平台事件转成 GatewayRequest、把 GatewayResponse 写回。 */
/* 本机入口见 main.ts；全部依赖通过接口注入，本地用 mock 实现即可测。     */
/* ------------------------------------------------------------------ */

import type { PublishResult } from "../site/admin/data/adapter.ts"
import type { SnapshotEnvelope } from "../site/admin/data/snapshot.ts"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
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
  /** 演示模式会话：仅在 deps.demoMode 为真时被 authenticate 接受 */
  demo?: boolean
  /** 部署令牌会话：仅用于 OAuth 不可用时的运维登录，审计上单独标记 */
  bootstrap?: boolean
  /** 管理员账号密码会话：仅用于备用登录入口 */
  password?: boolean
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

export interface GatewayOAuth {
  /** 与飞书后台登记一致的回调地址 */
  redirectUri: string
  /** 构造飞书授权页地址（注入实现，网关不依赖具体域名常量） */
  authorizeUrl: (state: string, redirectUri: string) => string
  /** 二维码 SDK 专用的旧版授权页地址；缺省时复用 authorizeUrl */
  qrAuthorizeUrl?: (state: string, redirectUri: string) => string
}

export interface GatewayDeps {
  feishu: FeishuClient
  sessions: SessionStore
  publisher: PublishService
  snapshots: SnapshotService
  adminOpenIds: readonly string[]
  sessionTtlMs: number
  /** 本地开发用 http 时置 false；默认 true，测试按 Secure 断言 */
  secureCookies?: boolean
  /** 不传则 /api/auth/start 返回 501，POST exchange 仍可独立使用 */
  oauth?: GatewayOAuth
  /** 生产为 https://admin.example.com；本地可为 http://127.0.0.1:5173 */
  publicAdminOrigin?: string
  /** 本地为 /admin.html；生产 admin 子域根路径为空 */
  adminEntryPath?: string
  /** 限流实现；不传则用进程内固定窗口计数（单实例场景） */
  rateLimiter?: RateLimiter
  /** 按路由覆盖默认限流规则 */
  rateRules?: Partial<RateLimitRules>
  /** 演示模式：未配置飞书凭据也能启动访客站与工作台外壳，不提供登录 */
  demoMode?: boolean
  /** 部署引导令牌：OAuth 不可用时用固定令牌换管理员会话；空=关闭该入口 */
  bootstrapToken?: string
  /** 管理员账号密码登录：用户名 / 密码（密码为空则关闭该入口） */
  loginUser?: string
  loginPassword?: string
  displayName?: string
}

export interface RateLimitRules {
  exchange: RateLimitRule
  publish: RateLimitRule
}

interface QrTicket {
  id: string
  claimToken: string
  next: string
  status: "pending" | "scanned" | "authorized" | "denied"
  sid?: string
  error?: string
  createdAt: number
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
      "x-content-type-options": "nosniff",
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

function html(
  status: number,
  body: string,
  extra?: Record<string, string>,
): GatewayResponse {
  return {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...(extra ?? {}),
    },
    body,
  }
}

/**
 * 取客户端 IP。网关只监听 127.0.0.1，由本机 Nginx 覆盖写入代理头，
 * 因此优先取 X-Real-IP；没有该头时再退到 X-Forwarded-For 首值。
 * 直接暴露公网时必须由前置代理覆盖这两个头，否则限流可被伪造 IP 绕过。
 */
function clientIp(headers: Record<string, string>): string {
  const real = headers["x-real-ip"]
  if (real) return real.trim()
  const forwarded = headers["x-forwarded-for"]
  if (forwarded) return forwarded.split(",")[0].trim()
  return headers["cf-connecting-ip"] ?? "unknown"
}

function tooMany(retryAfterMs: number): GatewayResponse {
  const seconds = String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
  return error(429, "RATE_LIMITED", "请求过于频繁，请稍后再试", {
    "retry-after": seconds,
  })
}

/** 浏览器回跳（授权回调用）：空响应体 + Location，会话走 Set-Cookie 头。 */
function redirect(location: string, extra?: Record<string, string>): GatewayResponse {
  return { status: 302, headers: { location, ...(extra ?? {}) }, body: "" }
}

function sessionCookie(sid: string, secure = true): string {
  return (
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}; ` +
    `HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/`
  )
}

const OAUTH_STATE_COOKIE = "oauth_state"

function oauthStateCookie(state: string, secure = true): string {
  return (
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; ` +
    `HttpOnly; ${secure ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=600`
  )
}

function adminPage(deps: GatewayDeps, hashPath: string): string {
  const hash = hashPath.startsWith("#") ? hashPath.slice(1) : hashPath
  const origin = deps.publicAdminOrigin ?? ""
  const entry = origin ? (deps.adminEntryPath ?? "") : ""
  // 未注入管理台 origin（单测 / 同域部署）时退回站点根路径。
  return `${origin || "/"}${entry}#${hash}`
}

function safeNext(raw: string | null | undefined): string {
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin/"
  return next.replace(/[\r\n]/g, "")
}

function encodeStatePayload(payload: { n: string; v: string; q?: string }): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function decodeStatePayload(state: string): { next: string; ticket?: string } {
  try {
    const padded = state.replace(/-/g, "+").replace(/_/g, "/")
    const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))
    const parsed = JSON.parse(bin) as { n?: unknown; q?: unknown }
    return {
      next: typeof parsed.n === "string" ? safeNext(parsed.n) : "/admin/",
      ticket: typeof parsed.q === "string" && parsed.q ? parsed.q : undefined,
    }
  } catch {
    return { next: "/admin/" }
  }
}

function encodeState(next: string, ticket?: string): string {
  return encodeStatePayload({ n: safeNext(next), v: crypto.randomUUID(), ...(ticket ? { q: ticket } : {}) })
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

/** OAuth start 失败时回登录页（不泄露配置细节）。 */
function backWithLogin(deps: GatewayDeps, code: string): GatewayResponse {
  return redirect(adminPage(deps, `/login/?error=${encodeURIComponent(code)}`))
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
  // 演示会话只在 demoMode 开启期间有效；关掉演示模式后旧 Cookie 立即失效。
  if (session.demo) {
    if (!deps.demoMode) {
      return { ok: false, response: error(401, "AUTH_REQUIRED", "演示会话已失效") }
    }
    return { ok: true, session, sid }
  }
  if (!deps.adminOpenIds.includes(session.openId)) {
    return { ok: false, response: error(403, "NOT_ALLOWED", "账号不在管理员白名单") }
  }
  return { ok: true, session, sid }
}

/**
 * 换票成功后的公共步骤：白名单校验 → 建会话。
 * POST /api/auth/exchange 与 GET /api/auth/callback 共用，保证两条登录路径行为一致。
 */
async function establishSession(
  deps: GatewayDeps,
  user: FeishuUser,
): Promise<
  { ok: true; session: SessionPayload; sid: string } | { ok: false; response: GatewayResponse }
> {
  if (!deps.adminOpenIds.includes(user.openId)) {
    console.warn(`[gateway] auth denied open_id=${user.openId} name=${user.name}`)
    return { ok: false, response: error(403, "NOT_ALLOWED", "该账号不在管理员白名单") }
  }
  const now = Date.now()
  const expiresAt = now + deps.sessionTtlMs
  const session: SessionPayload = {
    openId: user.openId,
    name: deps.displayName || user.name,
    avatarUrl: user.avatarUrl,
    createdAt: now,
    expiresAt,
  }
  const sid = await deps.sessions.create(session)
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
  const qrTickets = new Map<string, QrTicket>()
  const QR_TICKET_TTL_MS = 5 * 60 * 1000

  function readTicket(id: string): QrTicket | null {
    const ticket = qrTickets.get(id)
    if (!ticket) return null
    if (Date.now() - ticket.createdAt > QR_TICKET_TTL_MS) {
      qrTickets.delete(id)
      return null
    }
    return ticket
  }

  function ticketOrigin(): string {
    return deps.oauth ? new URL(deps.oauth.redirectUri).origin : ""
  }

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
        const est = await establishSession(deps, user)
        if (!est.ok) return est.response
        return json(
          200,
          {
            name: est.session.name,
            avatarUrl: est.session.avatarUrl,
            openIdSuffix: maskOpenId(est.session.openId),
            expiresAt: est.session.expiresAt,
          },
          { "set-cookie": sessionCookie(est.sid, deps.secureCookies ?? true) },
        )
      } catch (e) {
        // 上游错误细节只进服务端日志，响应体保持抽象文案（不回传飞书内部信息）。
        console.error("[gateway] feishu exchange failed:", e instanceof Error ? e.message : e)
        return error(502, "UPSTREAM_FAILED", "飞书授权失败，请稍后重试")
      }
    }

    /* GET /api/auth/callback：飞书授权完成后的浏览器回跳（「安全设置」里登记的授权回调地址）。
     * 与 POST /api/auth/exchange 干同一件事，区别是浏览器导航语义：
     * 用 302 把浏览器送回工作台，会话经 Set-Cookie 下发；任何失败回登录页并带错误码。 */
    if (path === "/api/auth/callback" && method === "GET") {
      const qIndex = req.url.indexOf("?")
      const qs = qIndex >= 0 ? new URLSearchParams(req.url.slice(qIndex + 1)) : null
      const oauthState = parseCookies(req.headers)[OAUTH_STATE_COOKIE]
      const stateParam = qs?.get("state")
      const stateInfo = deps.oauth
        ? decodeStatePayload(stateParam ?? "")
        : { next: "/admin/", ticket: undefined }
      const ticket = stateInfo.ticket ? readTicket(stateInfo.ticket) : null
      const next = stateInfo.next
      const back = (err?: string, extra?: Record<string, string>) =>
        redirect(
          adminPage(
            deps,
            err ? `/login/?error=${encodeURIComponent(err)}` : next,
          ),
          extra,
        )
      const fail = (code: string): GatewayResponse => {
        if (ticket) {
          ticket.status = "denied"
          ticket.error = code
          return html(
            200,
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录未完成</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937"><main style="max-width:320px;padding:32px 24px;text-align:center"><div style="width:48px;height:48px;border-radius:14px;background:#fff1e6;color:#ea580c;display:grid;place-items:center;margin:0 auto 16px;font-size:24px">!</div><h1 style="font-size:20px;margin:0 0 8px">登录未完成</h1><p style="font-size:14px;line-height:1.7;color:#6b7280;margin:0">请回到电脑刷新二维码后重试。如提示无权限，请使用站点管理员账号。</p></main></body></html>`,
          )
        }
        return back(code)
      }
      const ok = (sid: string): GatewayResponse => {
        if (ticket) {
          ticket.status = "authorized"
          ticket.sid = sid
          return html(
            200,
            `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录成功</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937"><main style="max-width:320px;padding:32px 24px;text-align:center"><div style="width:48px;height:48px;border-radius:14px;background:#ecfdf5;color:#059669;display:grid;place-items:center;margin:0 auto 16px;font-size:24px">✓</div><h1 style="font-size:20px;margin:0 0 8px">登录成功</h1><p style="font-size:14px;line-height:1.7;color:#6b7280;margin:0">请回到电脑，页面会自动进入工作台。</p></main></body></html>`,
            { "set-cookie": sessionCookie(sid, deps.secureCookies ?? true) },
          )
        }
        return back(undefined, {
          "set-cookie": sessionCookie(sid, deps.secureCookies ?? true),
        })
      }

      // 授权页被拒绝时飞书会带 error=access_denied 回跳，不交换 code。
      const oauthError = qs?.get("error")
      if (oauthError) return fail(oauthError)

      if (deps.oauth) {
        if (!oauthState || !stateParam || oauthState !== stateParam) {
          return fail("state_mismatch")
        }
      }
      const code = qs?.get("code")
      if (!code) return fail("missing_code")
      const gate = limiter.hit(`exchange:${clientIp(req.headers)}`, rules.exchange)
      if (!gate.allowed) return fail("rate_limited")
      try {
        const { user } = await deps.feishu.exchangeCode(code)
        const est = await establishSession(deps, user)
        if (!est.ok) return fail("not_allowed")
        return ok(est.sid)
      } catch (e) {
        console.error("[gateway] feishu callback failed:", e instanceof Error ? e.message : e)
        return fail("upstream")
      }
    }

    /* POST /api/auth/password：管理员账号密码登录（备用入口）。
     * 用户名/密码均来自服务端环境变量；密码为空时该端点不存在。
     * 密码比较前先做定长摘要，避免长度侧信道；失败按 IP 计入登录限流。 */
    if (path === "/api/auth/password" && method === "POST") {
      const expectedPassword = deps.loginPassword ?? ""
      if (deps.demoMode || !expectedPassword) {
        return error(404, "NOT_FOUND", "账号密码登录未启用")
      }
      const body = parseBody(req.bodyText)
      if (!body) return error(400, "BAD_REQUEST", "请求体不是合法 JSON")
      const gate = limiter.hit(`exchange:${clientIp(req.headers)}`, rules.exchange)
      if (!gate.allowed) return tooMany(gate.retryAfterMs)
      const suppliedUser = typeof body.username === "string" ? body.username : ""
      const suppliedPassword = typeof body.password === "string" ? body.password : ""
      const expectedUser = deps.loginUser ?? "admin"
      const a = createHash("sha256").update(suppliedPassword).digest()
      const b = createHash("sha256").update(expectedPassword).digest()
      const matched = timingSafeEqual(a, b)
      if (suppliedUser !== expectedUser || !matched) {
        return error(401, "INVALID_CREDENTIALS", "账号或密码不正确")
      }
      const now = Date.now()
      const session: SessionPayload = {
        openId: deps.adminOpenIds[0],
        name: deps.displayName ?? "HugoW",
        avatarUrl: "",
        createdAt: now,
        expiresAt: now + deps.sessionTtlMs,
        password: true,
      }
      const sid = await deps.sessions.create(session)
      return json(
        200,
        {
          name: session.name,
          avatarUrl: session.avatarUrl,
          openIdSuffix: maskOpenId(session.openId),
          expiresAt: session.expiresAt,
          source: "password",
        },
        { "set-cookie": sessionCookie(sid, deps.secureCookies ?? true) },
      )
    }

    /* POST /api/auth/bootstrap：OAuth 不可用时的部署令牌登录。
     * 只在服务端配置了 ADMIN_BOOTSTRAP_TOKEN 且非演示模式时开放；
     * 令牌比较用 timingSafeEqual，失败按 IP 计入登录限流。 */
    if (path === "/api/auth/bootstrap" && method === "POST") {
      const expected = deps.bootstrapToken ?? ""
      if (deps.demoMode || !expected) {
        return error(404, "NOT_FOUND", "部署令牌登录未启用")
      }
      const body = parseBody(req.bodyText)
      if (!body) return error(400, "BAD_REQUEST", "请求体不是合法 JSON")
      const supplied = typeof body.token === "string" ? body.token : ""
      const gate = limiter.hit(`exchange:${clientIp(req.headers)}`, rules.exchange)
      if (!gate.allowed) return tooMany(gate.retryAfterMs)
      const a = Buffer.from(supplied)
      const b = Buffer.from(expected)
      const matched = a.length === b.length && timingSafeEqual(a, b)
      if (!matched) return error(401, "INVALID_BOOTSTRAP_TOKEN", "部署令牌不正确")
      const now = Date.now()
      const session: SessionPayload = {
        openId: deps.adminOpenIds[0],
        name: "HugoW",
        avatarUrl: "",
        createdAt: now,
        expiresAt: now + deps.sessionTtlMs,
        bootstrap: true,
      }
      const sid = await deps.sessions.create(session)
      return json(
        200,
        {
          name: session.name,
          avatarUrl: session.avatarUrl,
          openIdSuffix: maskOpenId(session.openId),
          expiresAt: session.expiresAt,
          source: "bootstrap",
        },
        { "set-cookie": sessionCookie(sid, deps.secureCookies ?? true) },
      )
    }

    /* POST /api/auth/demo：演示模式下的一次性管理员入口。
     * 只在 HUGOW_DEMO=1 时开放；真实部署关掉演示模式后此端点直接 404。 */
    if (path === "/api/auth/demo" && method === "POST") {
      if (!deps.demoMode) return error(404, "NOT_FOUND", "演示登录未启用")
      const now = Date.now()
      const session: SessionPayload = {
        openId: "demo_local_admin",
        name: "HugoW（演示）",
        avatarUrl: "",
        createdAt: now,
        expiresAt: now + deps.sessionTtlMs,
        demo: true,
      }
      const sid = await deps.sessions.create(session)
      return json(
        200,
        {
          name: session.name,
          avatarUrl: session.avatarUrl,
          openIdSuffix: "demo",
          expiresAt: session.expiresAt,
          source: "demo",
        },
        { "set-cookie": sessionCookie(sid, deps.secureCookies ?? true) },
      )
    }

    /* POST /api/auth/qr-ticket：创建一个扫码登录票据。
     * 二维码内容指向本网关的 /api/auth/qr-entry，手机打开后走标准 OAuth；
     * 电脑端轮询票据状态并领取会话，不再依赖飞书二维码 SDK 的 postMessage。 */
    if (path === "/api/auth/qr-ticket" && method === "POST") {
      if (deps.demoMode) return error(503, "DEMO_MODE", "当前是演示模式")
      if (!deps.oauth) return error(501, "OAUTH_NOT_CONFIGURED", "未配置飞书 OAuth")
      const gate = limiter.hit(`exchange:${clientIp(req.headers)}`, rules.exchange)
      if (!gate.allowed) return tooMany(gate.retryAfterMs)
      const body = parseBody(req.bodyText)
      const next = safeNext(typeof body?.next === "string" ? body.next : "/admin/")
      const id = randomBytes(18).toString("base64url")
      const claimToken = randomBytes(24).toString("base64url")
      const now = Date.now()
      // 顺手清理过期票据，避免长时间运行后 Map 只增不减。
      for (const [key, item] of qrTickets) {
        if (now - item.createdAt > QR_TICKET_TTL_MS) qrTickets.delete(key)
      }
      if (qrTickets.size >= 5000) {
        const oldest = qrTickets.keys().next().value
        if (oldest) qrTickets.delete(oldest)
      }
      qrTickets.set(id, {
        id,
        claimToken,
        next,
        status: "pending",
        createdAt: now,
      })
      return json(200, {
        id,
        token: claimToken,
        url: `${ticketOrigin()}/api/auth/qr-entry?id=${encodeURIComponent(id)}`,
        expiresAt: now + QR_TICKET_TTL_MS,
      })
    }

    /* GET /api/auth/qr-entry?id=：手机扫码后打开，跳转飞书授权页并带上票据。 */
    if (path === "/api/auth/qr-entry" && method === "GET") {
      if (!deps.oauth) return error(501, "OAUTH_NOT_CONFIGURED", "未配置飞书 OAuth")
      const qIndex = req.url.indexOf("?")
      const qs = qIndex >= 0 ? new URLSearchParams(req.url.slice(qIndex + 1)) : null
      const id = qs?.get("id") ?? ""
      const ticket = readTicket(id)
      if (!ticket) {
        return html(
          410,
          `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>二维码已失效</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937"><main style="max-width:320px;padding:32px 24px;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">二维码已失效</h1><p style="font-size:14px;line-height:1.7;color:#6b7280;margin:0">请回到电脑刷新二维码后重新扫描。</p></main></body></html>`,
        )
      }
      ticket.status = "scanned"
      const state = encodeState(ticket.next, ticket.id)
      try {
        return redirect(deps.oauth.authorizeUrl(state, deps.oauth.redirectUri), {
          "set-cookie": oauthStateCookie(state, deps.secureCookies ?? true),
        })
      } catch (e) {
        console.error("[gateway] qr entry failed:", e instanceof Error ? e.message : e)
        return error(502, "OAUTH_CONFIG", "飞书授权地址生成失败")
      }
    }

    /* GET /api/auth/qr-ticket?id=：电脑端轮询扫码状态。 */
    if (path === "/api/auth/qr-ticket" && method === "GET") {
      const qIndex = req.url.indexOf("?")
      const qs = qIndex >= 0 ? new URLSearchParams(req.url.slice(qIndex + 1)) : null
      const id = qs?.get("id") ?? ""
      const ticket = readTicket(id)
      if (!ticket) return json(200, { status: "expired" })
      return json(200, {
        status: ticket.status,
        error: ticket.error,
      })
    }

    /* POST /api/auth/qr-ticket/claim：电脑端用票据领取会话（一次性）。 */
    if (path === "/api/auth/qr-ticket/claim" && method === "POST") {
      const gate = limiter.hit(`exchange:${clientIp(req.headers)}`, rules.exchange)
      if (!gate.allowed) return tooMany(gate.retryAfterMs)
      const body = parseBody(req.bodyText)
      if (!body) return error(400, "BAD_REQUEST", "请求体不是合法 JSON")
      const id = typeof body.id === "string" ? body.id : ""
      const token = typeof body.token === "string" ? body.token : ""
      const ticket = readTicket(id)
      if (
        !ticket ||
        ticket.claimToken.length !== token.length ||
        !timingSafeEqual(Buffer.from(ticket.claimToken), Buffer.from(token))
      ) {
        return error(403, "QR_INVALID", "二维码无效，请刷新后重试")
      }
      if (ticket.status === "denied") {
        return error(403, "NOT_ALLOWED", "该飞书账号没有工作台权限", {
          "x-login-error": ticket.error ?? "not_allowed",
        })
      }
      if (ticket.status !== "authorized" || !ticket.sid) {
        return json(202, { status: ticket.status })
      }
      const sid = ticket.sid
      qrTickets.delete(id)
      return json(200, { ok: true, next: ticket.next }, {
        "set-cookie": sessionCookie(sid, deps.secureCookies ?? true),
      })
    }

    /* GET /api/auth/start：浏览器跳到飞书授权页，state 用签名前的随机值 + 回跳路径。 */
    if (path === "/api/auth/start" && method === "GET") {
      if (deps.demoMode) {
        return error(503, "DEMO_MODE", "当前是演示模式，尚未配置飞书应用凭据")
      }
      if (!deps.oauth) return error(501, "OAUTH_NOT_CONFIGURED", "未配置飞书 OAuth")
      const qIndex = req.url.indexOf("?")
      const qs = qIndex >= 0 ? new URLSearchParams(req.url.slice(qIndex + 1)) : null
      const next = safeNext(qs?.get("next"))
      const state = encodeState(next)
      try {
        const url = deps.oauth.authorizeUrl(state, deps.oauth.redirectUri)
        return redirect(url, {
          "set-cookie": oauthStateCookie(state, deps.secureCookies ?? true),
        })
      } catch (e) {
        console.error("[gateway] oauth start failed:", e instanceof Error ? e.message : e)
        return backWithLogin(deps, "oauth_config")
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
        source: auth.session.demo
          ? "demo"
          : auth.session.bootstrap
            ? "bootstrap"
            : auth.session.password
              ? "password"
              : "feishu",
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
            `${SESSION_COOKIE}=; HttpOnly; ${deps.secureCookies ?? true ? "Secure; " : ""}SameSite=Lax; Path=/; Max-Age=0`,
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
      try {
        const result = await publishLock("publish", () =>
          deps.publisher.publish(body.draft, auth.session),
        )
        return json(result.status === "ok" ? 200 : 207, result)
      } catch (e) {
        console.error("[gateway] publish failed:", e instanceof Error ? e.message : e)
        return error(500, "PUBLISH_FAILED", "发布失败，请稍后重试或查看服务日志")
      }
    }

    /* GET /api/snapshot/current */
    if (path === "/api/snapshot/current" && method === "GET") {
      try {
        return json(200, await deps.snapshots.current())
      } catch {
        return error(404, "SNAP_MISSING", "当前快照不可用")
      }
    }

    /* GET /api/data/current：仅用于开发/排障，与 /api/snapshot/current 同源。 */
    if (path === "/api/data/current" && method === "GET") {
      try {
        return json(200, await deps.snapshots.current())
      } catch {
        return error(404, "SNAP_MISSING", "当前快照不可用")
      }
    }

    /* GET /api/setup：返回不含密钥的配置状态，给向导做“是否已接通”判断。 */
    if (path === "/api/setup" && method === "GET") {
      return json(200, {
        oauthConfigured: Boolean(deps.oauth),
        adminCount: deps.adminOpenIds.length,
        secureCookies: deps.secureCookies ?? true,
        demoMode: Boolean(deps.demoMode),
        bootstrapEnabled: Boolean(deps.bootstrapToken) && !deps.demoMode,
        passwordEnabled: Boolean(deps.loginPassword) && !deps.demoMode,
      })
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
