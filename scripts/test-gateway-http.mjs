/* ------------------------------------------------------------------ */
/* 网关进程集成测试：真的 spawn src/server/main.ts，再打 /api。          */
/* 目的：验证 systemd ExecStart 这条路径能启动、能健康检查、能发起 OAuth。 */
/* 运行：node scripts/test-gateway-http.mjs                              */
/* ------------------------------------------------------------------ */

import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

const port = await freePort()
const origin = `http://127.0.0.1:${port}`

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "src/server/main.ts"],
  {
    cwd: path.resolve(root, ".."),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: path.resolve(root, "..", "data-test-http"),
      FEISHU_APP_ID: "cli_test_gateway",
      FEISHU_APP_SECRET: "test-secret-not-real",
      BITABLE_APP_TOKEN: "test-base-token",
      ADMIN_OPEN_IDS: "ou_admin_1234567890",
      SESSION_SECRET: "test-session-secret-32-bytes-long",
      SESSION_TTL_MS: String(12 * 3600 * 1000),
      COOKIE_SECURE: "false",
      PUBLIC_GATEWAY_ORIGIN: origin,
      PUBLIC_ADMIN_ORIGIN: "http://127.0.0.1:5173",
      ADMIN_ENTRY_PATH: "/admin.html",
      FEISHU_REDIRECT_URI: `${origin}/api/auth/callback`,
      FEISHU_OAUTH_SCOPE: "auth:user.id:read",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
)

let output = ""
child.stdout.on("data", (chunk) => {
  output += String(chunk)
})
child.stderr.on("data", (chunk) => {
  output += String(chunk)
})

function cleanup() {
  if (!child.killed) child.kill()
}
process.on("exit", cleanup)
process.on("SIGINT", () => {
  cleanup()
  process.exit(1)
})

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${origin}/api/health`)
      if (res.ok) return
    } catch {
      /* 还没起来 */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`网关未在 10s 内启动：\n${output}`)
}

const failures = []
async function t(name, fn) {
  try {
    await fn()
    console.log(`PASS  ${name}`)
  } catch (err) {
    failures.push({ name, err })
    console.log(`FAIL  ${name}\n      ${err instanceof Error ? err.message : err}`)
  }
}

try {
  await waitForHealth()

  await t("进程启动后 /api/health 返回 200", async () => {
    const res = await fetch(`${origin}/api/health`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.ok, true)
  })

  await t("/api/setup 返回配置状态且不含密钥", async () => {
    const res = await fetch(`${origin}/api/setup`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.oauthConfigured, true)
    assert.equal(body.adminCount, 1)
    assert.equal(body.secureCookies, false)
    const raw = JSON.stringify(body)
    assert.ok(!raw.includes("test-secret"))
  })

  await t("/api/auth/start 302 到飞书授权页并带 state Cookie", async () => {
    const res = await fetch(`${origin}/api/auth/start?next=/admin/`, { redirect: "manual" })
    assert.equal(res.status, 302)
    const location = res.headers.get("location") ?? ""
    assert.ok(location.startsWith("https://accounts.feishu.cn/open-apis/authen/v1/authorize"))
    assert.ok(location.includes("client_id=cli_test_gateway"))
    assert.ok(location.includes("redirect_uri="))
    const cookie = res.headers.get("set-cookie") ?? ""
    assert.ok(cookie.includes("oauth_state="))
    assert.ok(cookie.includes("HttpOnly"))
  })

  await t("未发布时 /api/data/current 返回 404", async () => {
    const res = await fetch(`${origin}/api/data/current`)
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.error.code, "SNAP_MISSING")
  })
} finally {
  cleanup()
}

if (failures.length > 0) {
  console.error(`\n合计 ${failures.length} 项失败`)
  process.exit(1)
}
console.log("\n网关进程集成测试全部通过")
