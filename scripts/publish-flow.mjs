/**
 * 发布闭环 E2E（工作台编辑 → 草稿 → 确认弹窗 → 发布 → 前台生效）。
 *
 * 连接已在运行的 dev server（默认 5173，可用 SMOKE_PORT 覆盖）。
 * 真实网关不可用时，用 page.addInitScript 固定 /api/auth/me 与 /api/publish
 * 的响应，只验证前端异步发布链路与「取消/确认」两条路径；服务端 12 表写入
 * 由 test:gateway / test:gateway-http 覆盖。
 */
import { chromium } from "playwright-core"

const BASE = `http://127.0.0.1:${Number(process.env.SMOKE_PORT || 5173)}/`
const TEST_BRAND = "HugoW-发布闭环"
const ORIGIN_BRAND = "HugoW"

const SESSION = {
  name: "HugoW",
  avatarUrl: "",
  openId: "ou_smoke_7f3c9a1b2d4e5f60",
  source: "mock",
  loginAt: Date.now(),
}

const results = []
function record(name, ok, detail = "") {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`)
}

const browser = await chromium.launch({ channel: "chrome", headless: true })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await context.addInitScript(() => {
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    if (url.includes("/api/auth/me")) {
      return new Response(
        JSON.stringify({
          name: "HugoW",
          avatarUrl: "",
          openIdSuffix: "…1234",
          source: "feishu",
          expiresAt: Date.now() + 3600_000,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    if (url.includes("/api/publish")) {
      return new Response(
        JSON.stringify({
          status: "ok",
          version: "e2e-test",
          writtenTables: [],
          at: Date.now(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    if (url.includes("data/current.json")) {
      return new Response("", { status: 404 })
    }
    return realFetch(input, init)
  }
})
const page = await context.newPage()

// 弹窗动作可在运行时切换：先取消、后确认
let dialogAction = "dismiss"
page.on("dialog", async (dialog) => {
  if (dialogAction === "accept") {
    await dialog.accept()
  } else {
    await dialog.dismiss()
  }
})

try {
  /* 登录 */
  await page.goto(BASE + "admin.html#/admin/", { waitUntil: "domcontentloaded" })
  await page.evaluate((s) => localStorage.setItem("hugow-admin-session-v1", JSON.stringify(s)), SESSION)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => document.body.innerText.includes("总览"), null, { timeout: 15000 })
  // 首次进入会自动打开初始化向导，先关掉，避免遮罩拦截侧栏点击。
  const later = page.getByRole("button", { name: "稍后再配" })
  if (await later.isVisible().catch(() => false)) await later.click()
  await page.waitForTimeout(500)

  /* 进入站点信息，改品牌名 */
  await page.getByRole("button", { name: "站点信息" }).first().click()
  await page.waitForTimeout(600)
  const firstInput = page.locator("input").first()
  await firstInput.fill(TEST_BRAND)
  await page.waitForTimeout(500)
  const draftSaved = await page.evaluate((t) =>
    (localStorage.getItem("hugow-admin-draft-v1") || "").includes(t), TEST_BRAND)
  record("编辑后写入草稿", draftSaved)

  /* 路径一：取消 → 不发布 */
  dialogAction = "dismiss"
  await page.getByRole("button", { name: "发布全部" }).first().click()
  await page.waitForTimeout(800)
  const notPublished = await page.evaluate((t) =>
    !(localStorage.getItem("hugow-admin-published-v1") || "").includes(t), TEST_BRAND)
  record("确认弹窗取消后不发布", notPublished)

  /* 路径二：确认 → 发布 */
  dialogAction = "accept"
  await page.getByRole("button", { name: "发布全部" }).first().click()
  await page.waitForTimeout(1000)
  const published = await page.evaluate((t) =>
    (localStorage.getItem("hugow-admin-published-v1") || "").includes(t), TEST_BRAND)
  record("确认弹窗确认后已发布", published)

  /* 前台读已发布数据并显示 */
  await page.goto(BASE + "#/", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(800)
  const frontShows = await page.evaluate((t) => document.body.innerText.includes(t), TEST_BRAND)
  record("前台显示已发布内容", frontShows)

  /* 恢复：改回原品牌并发布，保持数据干净 */
  await page.goto(BASE + "admin.html#/admin/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => document.body.innerText.includes("站点信息"), null, { timeout: 10000 })
  const later2 = page.getByRole("button", { name: "稍后再配" })
  if (await later2.isVisible().catch(() => false)) await later2.click()
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: "站点信息" }).first().click()
  await page.waitForTimeout(500)
  await page.locator("input").first().fill(ORIGIN_BRAND)
  await page.waitForTimeout(400)
  dialogAction = "accept"
  await page.getByRole("button", { name: "发布全部" }).first().click()
  await page.waitForTimeout(1000)
  const restored = await page.evaluate((t) =>
    !(localStorage.getItem("hugow-admin-published-v1") || "").includes(t), TEST_BRAND)
  record("测试数据已恢复", restored)
} catch (err) {
  record("发布闭环脚本异常中断", false, String(err).split("\n")[0].slice(0, 160))
  try {
    console.log("页面正文片段：", (await page.evaluate(() => document.body.innerText)).slice(0, 400))
    await page.screenshot({ path: "publish-flow-fail.png" })
  } catch {
    /* 诊断失败不淹没错因 */
  }
} finally {
  await context.close()
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`)
process.exit(failed.length === 0 ? 0 : 1)
