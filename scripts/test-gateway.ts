/* ------------------------------------------------------------------ */
/* 网关单元测试。运行：node --experimental-strip-types                  */
/* scripts/test-gateway.ts。                                            */
/* ------------------------------------------------------------------ */

import assert from "node:assert/strict"

import {
  createGateway,
  type GatewayDeps,
  type GatewayRequest,
  type SessionPayload,
  type SessionStore,
} from "../src/server/gateway.ts"
import { createSignedSessionStore } from "../src/server/session.ts"
import type { PublishResult } from "../src/site/admin/data/adapter"

const ADMIN_OPEN_ID = "ou_admin_1234567890"
const TTL = 12 * 3600 * 1000

class MemSessions implements SessionStore {
  private readonly m = new Map<string, SessionPayload>()
  async create(payload: SessionPayload): Promise<string> {
    const sid = "sid-" + (this.m.size + 1)
    this.m.set(sid, payload)
    return sid
  }
  async get(sid: string): Promise<SessionPayload | null> {
    return this.m.get(sid) ?? null
  }
  async destroy(sid: string): Promise<void> {
    this.m.delete(sid)
  }
}

function makeDeps(over: Partial<GatewayDeps> = {}): GatewayDeps {
  const base: GatewayDeps = {
    feishu: {
      exchangeCode: async (code: string) => ({
        accessToken: "t-" + code,
        user: { name: "HugoW", avatarUrl: "", openId: ADMIN_OPEN_ID },
      }),
    },
    sessions: new MemSessions(),
    publisher: {
      publish: async (): Promise<PublishResult> => ({
        status: "ok",
        version: "v1",
        writtenTables: ["solutions"],
        at: 1,
      }),
    },
    snapshots: {
      current: async () => ({ version: "v1", generatedAt: 1, data: {} }),
    },
    adminOpenIds: [ADMIN_OPEN_ID],
    sessionTtlMs: TTL,
  }
  return { ...base, ...over }
}

function req(
  method: string,
  url: string,
  bodyText = "",
  headers: Record<string, string> = {},
): GatewayRequest {
  return { method, url, headers: { ...headers }, bodyText }
}

async function loginCookie(deps: GatewayDeps): Promise<string> {
  const handle = createGateway(deps)
  const res = await handle(
    req("POST", "/api/auth/exchange", JSON.stringify({ code: "c1" })),
  )
  assert.equal(res.status, 200)
  const m = /sid=([^;]+)/.exec(res.headers["set-cookie"] ?? "")
  assert.ok(m)
  return "sid=" + m![1]
}

let pass = 0

/* 用 async 顺序执行，保持输出顺序 */
const cases: Array<[string, () => Promise<void>]> = []
function t(name: string, fn: () => Promise<void>): void {
  cases.push([name, fn])
}

t("未知端点返回 404", async () => {
  const res = await createGateway(makeDeps())(req("GET", "/api/nope"))
  assert.equal(res.status, 404)
})

t("exchange 缺 code 返回 400", async () => {
  const res = await createGateway(makeDeps())(
    req("POST", "/api/auth/exchange", JSON.stringify({})),
  )
  assert.equal(res.status, 400)
})

t("exchange 非法 JSON 返回 400", async () => {
  const res = await createGateway(makeDeps())(
    req("POST", "/api/auth/exchange", "{bad"),
  )
  assert.equal(res.status, 400)
})

t("exchange 成功下发 HttpOnly Cookie", async () => {
  const deps = makeDeps()
  const res = await createGateway(deps)(
    req("POST", "/api/auth/exchange", JSON.stringify({ code: "c1" })),
  )
  assert.equal(res.status, 200)
  const cookie = res.headers["set-cookie"]
  assert.ok(cookie.includes("HttpOnly"))
  assert.ok(cookie.includes("Secure"))
  const body = JSON.parse(res.body)
  assert.equal(body.openIdSuffix, "…7890")
})

t("exchange 白名单外返回 403", async () => {
  const deps = makeDeps({
    feishu: {
      exchangeCode: async () => ({
        accessToken: "t",
        user: { name: "x", avatarUrl: "", openId: "ou_other_0000000001" },
      }),
    },
  })
  const res = await createGateway(deps)(
    req("POST", "/api/auth/exchange", JSON.stringify({ code: "c1" })),
  )
  assert.equal(res.status, 403)
})

t("exchange 上游失败返回 502", async () => {
  const deps = makeDeps({
    feishu: { exchangeCode: async () => { throw new Error("boom") } },
  })
  const res = await createGateway(deps)(
    req("POST", "/api/auth/exchange", JSON.stringify({ code: "c1" })),
  )
  assert.equal(res.status, 502)
  // 上游细节不回传客户端
  assert.ok(!res.body.includes("boom"))
})

t("callback 成功：302 回工作台并下发可用 Cookie", async () => {
  const deps = makeDeps()
  const res = await createGateway(deps)(req("GET", "/api/auth/callback?code=c1"))
  assert.equal(res.status, 302)
  assert.equal(res.headers.location, "/#/admin/")
  const m = /sid=([^;]+)/.exec(res.headers["set-cookie"] ?? "")
  assert.ok(m)
  // 回调下发的会话必须能直接通过 me 校验
  const me = await createGateway(deps)(
    req("GET", "/api/auth/me", "", { cookie: "sid=" + m[1] }),
  )
  assert.equal(me.status, 200)
})

t("callback 缺 code 回登录页", async () => {
  const res = await createGateway(makeDeps())(req("GET", "/api/auth/callback"))
  assert.equal(res.status, 302)
  assert.equal(res.headers.location, "/#/login/?error=missing_code")
})

t("callback 白名单外回登录页且不下发 Cookie", async () => {
  const deps = makeDeps({
    feishu: {
      exchangeCode: async () => ({
        accessToken: "t",
        user: { name: "x", avatarUrl: "", openId: "ou_other_0000000001" },
      }),
    },
  })
  const res = await createGateway(deps)(req("GET", "/api/auth/callback?code=c1"))
  assert.equal(res.status, 302)
  assert.equal(res.headers.location, "/#/login/?error=not_allowed")
  assert.equal(res.headers["set-cookie"], undefined)
})

t("me 无 Cookie 返回 401", async () => {
  const res = await createGateway(makeDeps())(req("GET", "/api/auth/me"))
  assert.equal(res.status, 401)
})

t("me 登录后返回会话摘要", async () => {
  const deps = makeDeps()
  const cookie = await loginCookie(deps)
  const res = await createGateway(deps)(
    req("GET", "/api/auth/me", "", { cookie }),
  )
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.body).name, "HugoW")
})

t("me 会话过期返回 401", async () => {
  // 同一 deps：cookie 必须来自被测实例自己的会话存储，
  // 否则 401 会来自「会话不存在」分支而非「已过期」分支（假阳性）。
  const deps = makeDeps({ sessionTtlMs: -1 })
  const cookie = await loginCookie(deps)
  const res = await createGateway(deps)(
    req("GET", "/api/auth/me", "", { cookie }),
  )
  assert.equal(res.status, 401)
  assert.match(JSON.parse(res.body).error.message, /已过期/)
})

t("publish 无 Cookie 返回 401", async () => {
  const res = await createGateway(makeDeps())(
    req("POST", "/api/publish", JSON.stringify({ draft: {} })),
  )
  assert.equal(res.status, 401)
})

t("publish 登录后成功返回 200", async () => {
  const deps = makeDeps()
  const cookie = await loginCookie(deps)
  const res = await createGateway(deps)(
    req("POST", "/api/publish", JSON.stringify({ draft: { order: 1 } }), { cookie }),
  )
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.body).status, "ok")
})

t("publish partial 返回 207", async () => {
  const deps = makeDeps({
    publisher: {
      publish: async (): Promise<PublishResult> => ({
        status: "partial",
        writtenTables: ["articles"],
        failedTables: [
          { table: "solutions", code: "PWB_TABLE_FAILED", message: "x", retryable: true },
        ],
      }),
    },
  })
  const cookie = await loginCookie(deps)
  const res = await createGateway(deps)(
    req("POST", "/api/publish", JSON.stringify({ draft: {} }), { cookie }),
  )
  assert.equal(res.status, 207)
  assert.equal(JSON.parse(res.body).status, "partial")
})

t("publish 缺 draft 返回 400", async () => {
  const deps = makeDeps()
  const cookie = await loginCookie(deps)
  const res = await createGateway(deps)(
    req("POST", "/api/publish", JSON.stringify({}), { cookie }),
  )
  assert.equal(res.status, 400)
})

t("logout 清 Cookie 且返回 200", async () => {
  const deps = makeDeps()
  const cookie = await loginCookie(deps)
  const res = await createGateway(deps)(
    req("POST", "/api/auth/logout", "", { cookie }),
  )
  assert.equal(res.status, 200)
  assert.ok(res.headers["set-cookie"].includes("Max-Age=0"))
})

t("snapshot/current 返回 200", async () => {
  const res = await createGateway(makeDeps())(
    req("GET", "/api/snapshot/current"),
  )
  assert.equal(res.status, 200)
})

t("snapshot 不可用时返回 404", async () => {
  const deps = makeDeps({
    snapshots: { current: async () => { throw new Error("missing") } },
  })
  const res = await createGateway(deps)(req("GET", "/api/snapshot/current"))
  assert.equal(res.status, 404)
})

t("health 返回健康状态与状态码计数", async () => {
  const handle = createGateway(makeDeps())
  await handle(req("GET", "/api/nope"))
  const res = await handle(req("GET", "/api/health"))
  assert.equal(res.status, 200)
  const body = JSON.parse(res.body)
  assert.equal(body.ok, true)
  assert.equal(body.requests.total, 1)
  assert.equal(body.requests.byStatus["404"], 1)
})

/* ---------------- 无状态签名会话 ---------------- */const SIGNED_SECRET = "test-signing-secret-32-bytes-long"

function payload(over: Partial<SessionPayload> = {}): SessionPayload {
  return {
    openId: ADMIN_OPEN_ID,
    name: "HugoW",
    avatarUrl: "",
    createdAt: 1000,
    expiresAt: 1000 + TTL,
    ...over,
  }
}

t("签名会话可原样取回", async () => {
  const store = createSignedSessionStore({ secret: SIGNED_SECRET })
  const sid = await store.create(payload())
  const got = await store.get(sid)
  assert.equal(got?.openId, ADMIN_OPEN_ID)
  assert.equal(got?.name, "HugoW")
})

t("签名被篡改时取不回会话", async () => {
  const store = createSignedSessionStore({ secret: SIGNED_SECRET })
  const sid = await store.create(payload())
  const tampered = sid.slice(0, -2) + (sid.endsWith("A") ? "BB" : "AA")
  assert.equal(await store.get(tampered), null)
})

t("换一个密钥签发的会话验不过", async () => {
  const issuer = createSignedSessionStore({ secret: SIGNED_SECRET })
  const verifier = createSignedSessionStore({ secret: SIGNED_SECRET + "-other" })
  const sid = await issuer.create(payload())
  assert.equal(await verifier.get(sid), null)
})

t("畸形 Cookie 返回 null", async () => {
  const store = createSignedSessionStore({ secret: SIGNED_SECRET })
  assert.equal(await store.get("not-a-token"), null)
  assert.equal(await store.get("a.b.c"), null)
})

t("签名会话可直接通过网关鉴权", async () => {
  const deps = makeDeps({
    sessions: createSignedSessionStore({ secret: SIGNED_SECRET }),
  })
  const cookie = await loginCookie(deps)
  const res = await createGateway(deps)(req("GET", "/api/auth/me", "", { cookie }))
  assert.equal(res.status, 200)
  assert.equal(JSON.parse(res.body).name, "HugoW")
})

/* ---------------- 限流 ---------------- */

t("exchange 超过 10 次/分返回 429 且带 Retry-After", async () => {
  const deps = makeDeps()
  const handle = createGateway(deps)
  for (let i = 0; i < 10; i += 1) {
    const ok = await handle(
      req("POST", "/api/auth/exchange", JSON.stringify({ code: "c" + i })),
    )
    assert.equal(ok.status, 200)
  }
  const blocked = await handle(
    req("POST", "/api/auth/exchange", JSON.stringify({ code: "c11" })),
  )
  assert.equal(blocked.status, 429)
  assert.equal(JSON.parse(blocked.body).error.code, "RATE_LIMITED")
  assert.ok(Number(blocked.headers["retry-after"]) >= 1)
})

t("publish 超过 3 次/分返回 429", async () => {
  const deps = makeDeps()
  const cookie = await loginCookie(deps)
  const handle = createGateway(deps)
  for (let i = 0; i < 3; i += 1) {
    const ok = await handle(
      req("POST", "/api/publish", JSON.stringify({ draft: { order: i } }), { cookie }),
    )
    assert.equal(ok.status, 200)
  }
  const blocked = await handle(
    req("POST", "/api/publish", JSON.stringify({ draft: { order: 4 } }), { cookie }),
  )
  assert.equal(blocked.status, 429)
})

for (const [name, fn] of cases) {
  await fn()
  pass += 1
  console.log("PASS ", name)
}
console.log(`\n合计 ${pass} 项，全部通过`)
