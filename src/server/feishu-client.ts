/* ------------------------------------------------------------------ */
/* 真实飞书 OAuth 客户端（v2 OAuth + user_info）。                       */
/*                                                                    */
/* 为什么用 v2：不需要先换 app_access_token，直接以 client_id /          */
/* client_secret / code / redirect_uri 换 user_access_token；返回体是    */
/* 顶层平铺的 access_token（部分租户仍包 data，已兼容）。                 */
/*                                                                    */
/* 授权页域名是 accounts.feishu.cn（不是 open.feishu.cn）；回调地址必须  */
/* 与开发者后台「安全设置 → 重定向 URL」完全一致，否则 20029。           */
/* ------------------------------------------------------------------ */

import type { FeishuClient } from "./gateway.ts"
import { assertFeishuOk, requestJson, type FeishuEnvelope } from "./feishu-api.ts"

export interface FeishuClientOptions {
  appId: string
  appSecret: string
  /** 与后台登记完全一致的回调地址，例如 https://admin.example.com/api/auth/callback */
  redirectUri: string
  /** API 域名，默认 https://open.feishu.cn */
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

interface TokenResponse {
  code?: number
  msg?: string
  access_token?: string
  token_type?: string
  expires_in?: number
  data?: {
    access_token?: string
    token_type?: string
    expires_in?: number
  }
}

interface UserInfoResponse {
  name?: string
  en_name?: string
  avatar_url?: string
  avatar_middle?: string
  avatar_thumb?: string
  avatar_big?: string
  open_id?: string
}

function normalizeAvatar(raw: string | undefined): string {
  if (!raw) return ""
  if (raw.startsWith("//")) return "https:" + raw
  return raw
}

export function createFeishuClient(opts: FeishuClientOptions): FeishuClient {
  const baseUrl = (opts.baseUrl ?? "https://open.feishu.cn").replace(/\/$/, "")
  const redirectUri = opts.redirectUri
  const fetchImpl = (opts.fetchImpl ?? fetch) as typeof fetch
  const timeoutMs = opts.timeoutMs ?? 15_000

  return {
    async exchangeCode(code: string) {
      const tokenRes = await requestJson<TokenResponse>(
        `${baseUrl}/open-apis/authen/v2/oauth/token`,
        {
          method: "POST",
          body: {
            grant_type: "authorization_code",
            client_id: opts.appId,
            client_secret: opts.appSecret,
            code,
            redirect_uri: redirectUri,
          },
          timeoutMs,
          fetchImpl,
        },
      )

      const tokenBody = tokenRes.body
      const codeValue = typeof tokenBody.code === "number" ? tokenBody.code : 0
      if (!tokenRes.status || tokenRes.status >= 400 || codeValue !== 0) {
        const msg = tokenBody.msg || `飞书错误码 ${codeValue}`
        throw new Error(`飞书登录换取令牌失败：${msg}（code=${codeValue}）`)
      }
      const accessToken = tokenBody.access_token ?? tokenBody.data?.access_token
      if (!accessToken) throw new Error("飞书登录响应缺少 access_token")

      const infoRes = await requestJson<FeishuEnvelope<UserInfoResponse>>(
        `${baseUrl}/open-apis/authen/v1/user_info`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
          timeoutMs,
          fetchImpl,
        },
      )
      const user = assertFeishuOk(infoRes.body, infoRes.status, "读取飞书用户信息")
      if (!user || typeof user.open_id !== "string" || !user.open_id) {
        throw new Error("飞书用户信息缺少 open_id")
      }

      return {
        accessToken,
        user: {
          name: user.name || user.en_name || "飞书用户",
          avatarUrl: normalizeAvatar(
            user.avatar_url ?? user.avatar_middle ?? user.avatar_thumb ?? user.avatar_big,
          ),
          openId: user.open_id,
        },
      }
    },
  }
}

export interface AuthorizeUrlOptions {
  appId: string
  redirectUri: string
  state: string
  scope?: string
  /** 默认 https://accounts.feishu.cn */
  accountsBase?: string
}

/** 构造飞书网页授权地址；scope 用空格分隔并自动 URL 编码。 */
export function buildFeishuAuthorizeUrl(opts: AuthorizeUrlOptions): string {
  const accountsBase = (opts.accountsBase ?? "https://accounts.feishu.cn").replace(/\/$/, "")
  const url = new URL(`${accountsBase}/open-apis/authen/v1/authorize`)
  url.searchParams.set("client_id", opts.appId)
  url.searchParams.set("redirect_uri", opts.redirectUri)
  url.searchParams.set("state", opts.state)
  const scope = (opts.scope ?? "").trim()
  if (scope) url.searchParams.set("scope", scope)
  return url.toString()
}

/** 飞书二维码 SDK 只支持旧版授权页，需走 passport 域名。 */
export function buildFeishuLegacyAuthorizeUrl(opts: AuthorizeUrlOptions): string {
  const url = new URL("https://passport.feishu.cn/suite/passport/oauth/authorize")
  url.searchParams.set("client_id", opts.appId)
  url.searchParams.set("redirect_uri", opts.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("state", opts.state)
  const scope = (opts.scope ?? "").trim()
  if (scope) url.searchParams.set("scope", scope)
  return url.toString()
}
