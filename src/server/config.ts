/* ------------------------------------------------------------------ */
/* 网关配置：只从环境变量读取，不把 Secret 落到代码或前端。              */
/*                                                                    */
/* 生产环境由 systemd EnvironmentFile 注入；本地开发可复制              */
/* deploy/gateway.env.example 为 .env，再用 --env-file 启动。            */
/* ------------------------------------------------------------------ */

import path from "node:path"

export interface GatewayConfig {
  host: string
  port: number
  dataDir: string
  demoMode: boolean
  appId: string
  appSecret: string
  bitableAppToken: string
  adminOpenIds: string[]
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
    adminOpenIds: adminOpenIds.length > 0 ? adminOpenIds : ["demo-open-id"],
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
