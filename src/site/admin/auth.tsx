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
  /** 登录来源：feishu = 真实飞书授权；mock 仅为历史缓存兼容 */
  source: "mock" | "feishu"
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
      source: u.source === "feishu" ? "feishu" : "mock",
      loginAt: u.loginAt,
    }
  } catch {
    return null
  }
}

/** 用网关 /api/auth/me 的用户信息写入本地展示缓存。 */
export function signInFeishu(info: {
  name: string
  avatarUrl: string
  openId: string
}): AdminUser {
  const user: AdminUser = { ...info, source: "feishu", loginAt: Date.now() }
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
    return signInFeishu({
      name: data.name,
      avatarUrl: typeof data.avatarUrl === "string" ? data.avatarUrl : "",
      openId: typeof data.openIdSuffix === "string" ? data.openIdSuffix : "…",
    })
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
          工作台仅对管理员开放。使用飞书账号登录后，网关会校验 open_id 白名单并下发
          HttpOnly 会话 Cookie；未登录时不会加载任何编辑数据。
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
