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
  const deps = makeDeps({ sessionTtlMs: -1 })
  const cookie = await loginCookie(makeDeps())
  const res = await createGateway(deps)(
    req("GET", "/api/auth/me", "", { cookie }),
  )
  assert.equal(res.status, 401)
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

for (const [name, fn] of cases) {
  await fn()
  pass += 1
  console.log("PASS ", name)
}
console.log(`\n合计 ${pass} 项，全部通过`)
