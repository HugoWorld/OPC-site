/* ------------------------------------------------------------------ */
/* 网关配置：只从环境变量读取，不把 Secret 落到代码或前端。              */
/*                                                                    */
/* 生产环境由 systemd EnvironmentFile 注入；本地开发可复制              */
/* deploy/gateway.env.example 为 .env，再用 --env-file 启动。            */
/* ------------------------------------------------------------------ */

import path from "node:path"

/** Base 同步策略，与 feishu-publisher.ts 的 BaseSyncMode 保持一致（避免 server 反向依赖发布器）。 */
export type BaseSyncMode = "required" | "best-effort" | "off"

export interface GatewayConfig {
  host: string
  port: number
  dataDir: string
  demoMode: boolean
  appId: string
  appSecret: string
  bitableAppToken: string
  /** 直接注入的 Base access token（user_access_token / tenant_access_token）；空=用 app 身份换 token */
  baseAccessToken: string
  /** required | best-effort | off */
  baseSyncMode: BaseSyncMode
  adminOpenIds: string[]
  /**
   * 部署引导令牌：OAuth 不可用时，运维可用它换取管理员会话。
   * 只从服务端环境变量读取，前端只提交输入值，不落 localStorage。
   */
  bootstrapToken: string
  /** 管理员账号密码登录：用户名（默认 admin） */
  loginUser: string
  /** 管理员账号密码登录：密码；为空则关闭该入口 */
  loginPassword: string
  /** 账号密码登录后展示的姓名 */
  displayName: string
  /** 是否启用飞书 OAuth；个人账号无企业租户时可置 0，改用部署令牌登录 */
  oauthEnabled: boolean
  sessionSecret: string
  sessionTtlMs: number
  secureCookies: boolean
  publicGatewayOrigin: string
  publicAdminOrigin: string
  adminEntryPath: string
  redirectUri: string
  oauthScope: string
  feishuBaseUrl: string
  feishuAccountsBaseUrl: string
}

function envString(env: NodeJS.ProcessEnv, key: string, fallback = ""): string {
  const value = env[key]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function envNumber(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function envBool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]
  if (raw === undefined) return fallback
  return raw !== "0" && raw.toLowerCase() !== "false" && raw.toLowerCase() !== "no"
}

function splitIds(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const port = envNumber(env, "PORT", 8787)
  const host = envString(env, "HOST", "127.0.0.1")
  const demoMode = envBool(env, "HUGOW_DEMO", false)
  const publicGatewayOrigin =
    envString(env, "PUBLIC_GATEWAY_ORIGIN", `http://${host}:${port}`).replace(/\/$/, "")
  const publicAdminOrigin = envString(
    env,
    "PUBLIC_ADMIN_ORIGIN",
    "http://127.0.0.1:5173",
  ).replace(/\/$/, "")
  const adminEntryPath = envString(env, "ADMIN_ENTRY_PATH", "")

  const appId = envString(env, "FEISHU_APP_ID")
  const appSecret = envString(env, "FEISHU_APP_SECRET")
  const sessionSecret = envString(env, "SESSION_SECRET")
  const adminOpenIds = splitIds(envString(env, "ADMIN_OPEN_IDS"))
  const baseAccessToken = envString(env, "FEISHU_BASE_ACCESS_TOKEN")
  const bootstrapToken = envString(env, "ADMIN_BOOTSTRAP_TOKEN")
  const loginUser = envString(env, "ADMIN_LOGIN_USER", "admin")
  const loginPassword = envString(env, "ADMIN_LOGIN_PASSWORD")
  const displayName = envString(env, "ADMIN_DISPLAY_NAME", "HugoW")
  const oauthEnabled = envBool(env, "FEISHU_OAUTH_ENABLED", true)
  const rawBaseSyncMode = envString(env, "FEISHU_BASE_SYNC", "required").toLowerCase()
  const baseSyncMode: BaseSyncMode =
    rawBaseSyncMode === "off" || rawBaseSyncMode === "best-effort" || rawBaseSyncMode === "required"
      ? rawBaseSyncMode
      : "required"

  if (!demoMode) {
    if (!appId || !appSecret) {
      throw new Error("缺少 FEISHU_APP_ID / FEISHU_APP_SECRET（见 deploy/gateway.env.example）")
    }
    if (sessionSecret.length < 16) {
      throw new Error("SESSION_SECRET 至少需要 16 个字符")
    }
    if (adminOpenIds.length === 0) {
      throw new Error("ADMIN_OPEN_IDS 至少需要一个管理员 open_id")
    }
    if (bootstrapToken && bootstrapToken.length < 16) {
      throw new Error("ADMIN_BOOTSTRAP_TOKEN 至少需要 16 个字符")
    }
    if (loginPassword && loginPassword.length < 10) {
      throw new Error("ADMIN_LOGIN_PASSWORD 至少需要 10 个字符")
    }
  }

  const redirectUri = envString(
    env,
    "FEISHU_REDIRECT_URI",
    `${publicGatewayOrigin}/api/auth/callback`,
  )

  return {
    host,
    port,
    demoMode,
    dataDir: path.resolve(envString(env, "DATA_DIR", "./data")),
    appId: appId || "demo-app",
    appSecret: appSecret || "demo-secret",
    bitableAppToken: envString(env, "BITABLE_APP_TOKEN"),
    baseAccessToken,
    baseSyncMode,
    adminOpenIds: adminOpenIds.length > 0 ? adminOpenIds : ["demo-open-id"],
    bootstrapToken,
    loginUser,
    loginPassword,
    displayName,
    oauthEnabled,
    sessionSecret: sessionSecret.length >= 16 ? sessionSecret : "demo-session-secret-not-for-production",
    sessionTtlMs: envNumber(env, "SESSION_TTL_MS", 12 * 3600 * 1000),
    secureCookies: envBool(
      env,
      "COOKIE_SECURE",
      publicGatewayOrigin.startsWith("https://"),
    ),
    publicGatewayOrigin,
    publicAdminOrigin,
    adminEntryPath,
    redirectUri,
    oauthScope: envString(env, "FEISHU_OAUTH_SCOPE", "auth:user.id:read"),
    feishuBaseUrl: envString(env, "FEISHU_BASE_URL", "https://open.feishu.cn"),
    feishuAccountsBaseUrl: envString(env, "FEISHU_ACCOUNTS_BASE_URL", "https://accounts.feishu.cn"),
  }
}

/** 构造管理台页面地址：生产 admin 子域根路径，开发用 /admin.html。 */
export function adminPageUrl(
  config: Pick<GatewayConfig, "publicAdminOrigin" | "adminEntryPath">,
  hashPath: string,
): string {
  const hash = hashPath.startsWith("#") ? hashPath : `#${hashPath}`
  return `${config.publicAdminOrigin}${config.adminEntryPath}${hash}`
}
