/* ------------------------------------------------------------------ */
/* 运营管理员登录态（FR-AUTH）                                          */
/*                                                                     */
/* 原型阶段（当前）：模拟飞书登录 —— 点击一次即写入占位会话，            */
/* 头像 / 姓名 / open_id 均为占位值，用于打通登录页、拦截、登出与用户区。 */
/*                                                                     */
/* 真实阶段（待凭据到位）：                                               */
/*   1. 跳转飞书授权页（网页应用授权码模式），回跳地址须在应用后台加白；   */
/*   2. 用授权码换取 user_access_token；                                  */
/*   3. 调飞书接口取用户信息：avatar_url / name / open_id / union_id；    */
/*   4. 校验 open_id 命中管理员白名单后，才写入会话并放行工作台。          */
/* 敏感项（app_secret、access_token）不得落在前端或 localStorage。        */
/* ------------------------------------------------------------------ */

export interface AdminUser {
  /** 飞书用户名（真实阶段取 user_info.name） */
  name: string
  /** 头像直链（真实阶段取 user_info.avatar_url；空则前台用首字占位） */
  avatarUrl: string
  /** 飞书 open_id（真实阶段取 user_info.open_id，用于白名单校验与审计） */
  openId: string
  /** 登录来源：mock = 原型占位，feishu = 真实飞书授权 */
  source: "mock" | "feishu"
  /** 登录时间戳（毫秒） */
  loginAt: number
}

/** 会话键（与草稿/已发布数据分开，登出只清会话不动内容） */
export const SESSION_KEY = "luoxiaoshan-admin-session-v1"

/** 会话有效期：真实阶段按飞书 token 生命周期；原型阶段给 12 小时，过期需重新登录 */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

/** 原型占位账号：字段结构与真实飞书用户一致，便于将来只替换数据来源 */
export const MOCK_USER: AdminUser = {
  name: "洛小山",
  avatarUrl: "",
  openId: "ou_mock_7f3c9a1b2d4e5f60",
  source: "mock",
  loginAt: 0,
}

export function loadSession(): AdminUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as Partial<AdminUser>
    if (!u || typeof u !== "object") return null
    if (typeof u.openId !== "string" || typeof u.name !== "string") return null
    if (typeof u.loginAt !== "number") return null
    // 过期即视为未登录（不自动续期，避免静默长期持有管理权限）
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

/** 原型模拟登录：写入占位会话并返回该用户 */
export function signInMock(): AdminUser {
  const user: AdminUser = { ...MOCK_USER, loginAt: Date.now() }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } catch {
    /* 隐私模式等场景下仅本次调用的返回对象生效 */
  }
  return user
}

/** 真实阶段使用：用飞书返回的用户信息写入会话 */
export function signInFeishu(info: { name: string; avatarUrl: string; openId: string }): AdminUser {
  const user: AdminUser = { ...info, source: "feishu", loginAt: Date.now() }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } catch {
    /* 同上 */
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

/** open_id 不完整展示，界面上只露尾号（避免把标识整串贴到截图里） */
export function shortOpenId(openId?: string) {
  if (!openId) return "未登录"
  const tail = openId.slice(-4)
  return `…${tail}`
}

/** 未登录时的拦截卡：工作台不渲染任何编辑界面 */
export function AdminLoginGate() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/10 text-[15px] font-bold text-primary">
          洛
        </span>
        <h1 className="mt-4 text-[18px] font-semibold">运营工作台需要登录</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          工作台仅对管理员开放，使用飞书账号登录后进入。原型阶段为模拟登录：
          头像、姓名与 open_id 均为占位值，真实接入后取自飞书用户信息并按 open_id 白名单校验。
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
