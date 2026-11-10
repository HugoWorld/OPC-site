/* ------------------------------------------------------------------ */
/* 无状态会话存储：HMAC-SHA256 签名的 Cookie，不依赖进程内 Map。          */
/*                                                                    */
/* 解决的问题：云函数多实例 / 冷启动时，进程内会话会丢；签名会话把状态   */
/* 放在 Cookie 自身，任何实例都能验签，网关可水平扩容。                  */
/*                                                                    */
/* 取舍：签名会话不落库；本实现额外维护有界撤销表，退出登录时把该 sid   */
/* 拉黑到 expiresAt，单实例内可立即失效。多实例部署仍需共享撤销表（如   */
/* Redis）才能跨实例撤签；因此 TTL 不宜过长（默认 12h），敏感操作（发布） */
/* 每次都重新校验签名与白名单。                                          */
/* ------------------------------------------------------------------ */

import type { SessionPayload, SessionStore } from "./gateway.ts"

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const bin = atob(padded + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  return toBase64Url(new Uint8Array(sig))
}

/** 定长比较，避免签名比对被计时侧信道利用。 */
function equalConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isPayload(v: unknown): v is SessionPayload {
  if (!v || typeof v !== "object") return false
  const p = v as Record<string, unknown>
  return (
    typeof p.openId === "string" &&
    typeof p.name === "string" &&
    typeof p.avatarUrl === "string" &&
    typeof p.createdAt === "number" &&
    typeof p.expiresAt === "number"
  )
}

function decodeBody(body: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as unknown
    return isPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

export interface SignedSessionOptions {
  /** 签名密钥，至少 16 字符；由网关环境变量注入，不进前端。 */
  secret: string
}

export function createSignedSessionStore(opts: SignedSessionOptions): SessionStore {
  if (opts.secret.length < 16) {
    throw new Error("会话签名密钥至少需要 16 个字符")
  }
  const secret = opts.secret
  /** sid -> 撤销截止时间（毫秒）。只在单实例内有效，按 TTL 自动清理。 */
  const revoked = new Map<string, number>()

  function sweepRevoked(now: number): void {
    if (revoked.size === 0) return
    for (const [sid, until] of revoked) {
      if (until <= now) revoked.delete(sid)
    }
  }

  return {
    async create(payload: SessionPayload): Promise<string> {
      const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
      const signature = await sign(secret, body)
      return `${body}.${signature}`
    },

    async get(sid: string): Promise<SessionPayload | null> {
      const now = Date.now()
      sweepRevoked(now)
      if (revoked.has(sid)) return null

      const dot = sid.indexOf(".")
      if (dot <= 0) return null
      const body = sid.slice(0, dot)
      const signature = sid.slice(dot + 1)
      if (!body || !signature) return null

      const expected = await sign(secret, body)
      if (!equalConstantTime(signature, expected)) return null

      const parsed = decodeBody(body)
      if (!parsed || parsed.expiresAt <= now) return null
      return parsed
    },

    /** 退出登录：把 sid 拉黑到其自身 expiresAt，单实例内立即失效。 */
    async destroy(sid: string): Promise<void> {
      const dot = sid.indexOf(".")
      if (dot <= 0) return
      const payload = decodeBody(sid.slice(0, dot))
      if (!payload) return
      revoked.set(sid, payload.expiresAt)
      sweepRevoked(Date.now())
    },
  }
}
