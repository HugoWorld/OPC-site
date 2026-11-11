/* ------------------------------------------------------------------ */
/* 运营管理员登录态（FR-AUTH）                                          */
/*                                                                     */
/* 真实链路：登录页 → /api/auth/start → 飞书授权页 → /api/auth/callback   */
/* → 网关校验 open_id 白名单 → Set-Cookie(HttpOnly) → 回工作台。          */
/*                                                                     */
/* 前端不接触 app_secret / user_access_token；localStorage 只缓存展示用  */
/* 的姓名、头像、open_id 尾号，真实鉴权以 HttpOnly Cookie 为准。          */
/* ------------------------------------------------------------------ */

export interface AdminUser {
  /** 飞书用户名（user_info.name） */
  name: string
  /** 头像直链（user_info.avatar_url；空则首字占位） */
  avatarUrl: string
  /** 展示用身份标识：完整 open_id 或「…尾号」。真实白名单在网关侧校验。 */
  openId: string
  /** 登录来源：feishu = 真实飞书授权；demo = 演示模式；bootstrap = 部署令牌；password = 管理员账号密码 */
  source: "mock" | "feishu" | "demo" | "bootstrap" | "password"
  /** 登录时间戳（毫秒） */
  loginAt: number
}

/** 会话键（与草稿/已发布数据分开，登出只清会话不动内容） */
export const SESSION_KEY = "hugow-admin-session-v1"

/** 本地缓存有效期 12 小时；真正的过期由网关会话 expiresAt 决定 */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

/** 兼容旧代码的占位常量；登录入口已不再使用模拟账号。 */
export const MOCK_USER: AdminUser = {
  name: "HugoW",
  avatarUrl: "",
  openId: "ou_mock_7f3c9a1b2d4e5f60",
  source: "mock",
  loginAt: 0,
}

/**
 * 网关前缀。默认 /api，由 Vite 代理或 Nginx 反代到 127.0.0.1:8787。
 * 本地直连可设 VITE_GATEWAY_BASE=http://127.0.0.1:8787（需网关 CORS）。
 */
export const GATEWAY_BASE = (
  (import.meta.env?.VITE_GATEWAY_BASE as string | undefined) ?? ""
).replace(/\/$/, "")

export function apiUrl(path: string): string {
  return `${GATEWAY_BASE}${path.startsWith("/") ? path : `/${path}`}`
}

export function loadSession(): AdminUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as Partial<AdminUser>
    if (!u || typeof u !== "object") return null
    if (typeof u.openId !== "string" || typeof u.name !== "string") return null
    if (typeof u.loginAt !== "number") return null
    if (Date.now() - u.loginAt > SESSION_TTL_MS) return null
    return {
      name: u.name,
      avatarUrl: typeof u.avatarUrl === "string" ? u.avatarUrl : "",
      openId: u.openId,
      source:
        u.source === "feishu" || u.source === "demo" || u.source === "bootstrap" || u.source === "password"
          ? u.source
          : "mock",
      loginAt: u.loginAt,
    }
  } catch {
    return null
  }
}

/** 用网关 /api/auth/me 或演示登录的用户信息写入本地展示缓存。 */
export function signInFeishu(
  info: {
    name: string
    avatarUrl: string
    openId: string
  },
  source: "feishu" | "demo" | "bootstrap" | "password" = "feishu",
): AdminUser {
  const user: AdminUser = { ...info, source, loginAt: Date.now() }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } catch {
    /* 隐私模式等场景下仅本次调用的返回对象生效 */
  }
  return user
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* 忽略 */
  }
}

interface MeResponse {
  name: string
  avatarUrl: string
  openIdSuffix?: string
  source?: string
}
/**
 * 以 Cookie 为准刷新登录态：命中返回用户并写缓存，401/403 清缓存返回 null。
 * AdminPage 挂载时调用，避免「本地有缓存但服务端会话已过期」的假登录。
 */
export async function fetchSession(signal?: AbortSignal): Promise<AdminUser | null> {
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      credentials: "include",
      signal,
      headers: { accept: "application/json" },
    })
    if (!res.ok) {
      signOut()
      return null
    }
    const data = (await res.json()) as MeResponse
    if (!data || typeof data.name !== "string") {
      signOut()
      return null
    }
    return signInFeishu(
      {
        name: data.name,
        avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : "",
        openId: typeof data.openIdSuffix === "string" ? data.openIdSuffix : "…",
      },
      data.source === "demo"
        ? "demo"
        : data.source === "bootstrap"
          ? "bootstrap"
          : data.source === "password"
            ? "password"
            : "feishu",
    )
  } catch {
    // 网关不可达时保留缓存，避免断网把用户直接踢出编辑界面。
    return loadSession()
  }
}

/** 跳飞书授权页；next 是回工作台后的 hash 路径，如 /admin/。 */
export function startFeishuLogin(next = "/admin/") {
  const target = apiUrl(`/api/auth/start?next=${encodeURIComponent(next)}`)
  window.location.assign(target)
}

/** 取二维码 SDK 需要的授权地址（含 state），同时服务端会种下 oauth_state Cookie。 */
export async function fetchFeishuQrUrl(next = "/admin/"): Promise<string> {
  const res = await fetch(apiUrl(`/api/auth/qr?next=${encodeURIComponent(next)}`), {
    credentials: "include",
    headers: { accept: "application/json" },
  })
  const body = (await res.json().catch(() => null)) as { url?: string } | null
  if (!res.ok || !body?.url) throw new Error("二维码生成失败，请重试")
  return body.url
}

/** 管理员账号密码登录（备用入口）。 */
export async function startPasswordLogin(
  username: string,
  password: string,
  next = "/admin/",
): Promise<void> {
  const res = await fetch(apiUrl("/api/auth/password"), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null
    if (res.status === 429) throw new Error("登录尝试过于频繁，请稍后再试")
    throw new Error(body?.error?.message ?? `登录失败（HTTP ${res.status}）`)
  }
  window.location.assign(`#${next}`)
}

/** 部署令牌登录：OAuth 不可用时，用服务端 ADMIN_BOOTSTRAP_TOKEN 换管理员会话。 */
export async function startBootstrapLogin(token: string, next = "/admin/"): Promise<void> {
  const res = await fetch(apiUrl("/api/auth/bootstrap"), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null
    if (res.status === 429) throw new Error("登录尝试过于频繁，请稍后再试")
    throw new Error(body?.error?.message ?? `部署令牌登录失败（HTTP ${res.status}）`)
  }
  window.location.assign(`#${next}`)
}

/** 演示模式专用：向网关换取演示会话 Cookie，再进入工作台。 */
export async function startDemoLogin(next = "/admin/"): Promise<void> {
  const res = await fetch(apiUrl("/api/auth/demo"), {
    method: "POST",
    credentials: "include",
    headers: { accept: "application/json" },
  })
  if (!res.ok) {
    throw new Error(`演示登录失败（HTTP ${res.status}）`)
  }
  window.location.assign(`#${next}`)
}

/** 通知服务端撤销会话（清 HttpOnly Cookie），再清本地展示缓存。 */
export async function signOutRemote(): Promise<void> {
  try {
    await fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
      headers: { accept: "application/json" },
    })
  } catch {
    /* 网关不可达也继续清本地，避免卡在退出页 */
  } finally {
    signOut()
  }
}

/** open_id 不完整展示，界面上只露尾号（避免把标识整串贴到截图里）。 */
export function shortOpenId(openId?: string) {
  if (!openId) return "未登录"
  if (openId.startsWith("…")) return openId
  return `…${openId.slice(-4)}`
}

/** 未登录时的拦截卡：工作台不渲染任何编辑界面。 */
export function AdminLoginGate() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/10 text-[15px] font-bold text-primary">
          H
        </span>
        <h1 className="mt-4 text-[18px] font-semibold">运营工作台需要登录</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          工作台仅对管理员开放。请先登录；未登录时不会加载任何编辑数据。
        </p>
        <a
          href="#/login/?next=/admin/"
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          去登录
        </a>
        <a href="#/" className="mt-3 inline-block text-[12.5px] text-muted-foreground hover:text-foreground">
          返回站点前台
        </a>
      </div>
    </div>
  )
}
