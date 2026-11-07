/**
 * 最小 E2E（PRD O-7）：路由可达 + 登录拦截 + 登录后工作台 + 首屏图片真实加载。
 *
 * 为什么用 playwright-core：只用本机已装的 Chrome（channel: chrome），
 * 不下载浏览器内核，CI 与本机都能跑；没有可见窗口（headless）。
 *
 * 用法：
 *   npm run build && node scripts/smoke.mjs
 * 可用环境变量覆盖：SMOKE_PORT（默认 4311）、SMOKE_BROWSER（chrome|msedge，默认 chrome）
 */
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright-core"

const DIST = path.resolve("dist")
const PORT = Number(process.env.SMOKE_PORT || 4311)
const CHANNEL = process.env.SMOKE_BROWSER || "chrome"

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
}

if (!fs.existsSync(DIST)) {
  console.error("dist 不存在，请先执行 npm run build")
  process.exit(2)
}

/** 极简静态服务器：命中文件就返回，否则回落 index.html（HashRouter 不需要，但保证健壮） */
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0])
  const target = path.join(DIST, urlPath === "/" ? "index.html" : urlPath)
  if (target.startsWith(DIST) && fs.existsSync(target) && fs.statSync(target).isFile()) {
    res.writeHead(200, { "content-type": MIME[path.extname(target)] || "application/octet-stream" })
    fs.createReadStream(target).pipe(res)
    return
  }
  res.writeHead(200, { "content-type": MIME[".html"] })
  fs.createReadStream(path.join(DIST, "index.html")).pipe(res)
})

/** 需要访问的站点路由及其应有的一级标题 */
const ROUTES = [
  { hash: "#/", expect: "把专业服务里最重复的部分", name: "首页" },
  { hash: "#/solutions/", expect: "能做什么", name: "能力模块" },
  { hash: "#/method/", expect: "怎么交付", name: "交付方法" },
  { hash: "#/cases/", expect: "案例", name: "案例" },
  { hash: "#/writing/", expect: "我在写", name: "文章" },
  { hash: "#/shares/", expect: "分享", name: "分享" },
  { hash: "#/about/", expect: "关于", name: "关于我" },
  { hash: "#/contact/", expect: "先聊场景", name: "联系" },
  { hash: "#/privacy/", expect: "隐私", name: "隐私" },
]

const SESSION = {
  name: "HugoW",
  avatarUrl: "",
  openId: "ou_smoke_7f3c9a1b2d4e5f60",
  source: "mock",
  loginAt: Date.now(),
}

const results = []
function record(name, ok, detail = "") {
  results.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`)
}

const browser = await chromium.launch({ channel: CHANNEL, headless: true })

try {
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r))
  const base = `http://127.0.0.1:${PORT}/`

  /* ---------- 1. 路由可达 ---------- */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const pageErrors = []
  page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 120)))

  for (const route of ROUTES) {
    await page.goto(base + route.hash, { waitUntil: "domcontentloaded" })
    let text = ""
    try {
      await page.waitForFunction(
        (expect) => (document.body.innerText || "").includes(expect),
        route.expect,
        { timeout: 8000 },
      )
      text = await page.evaluate(() => (document.body.innerText || "").slice(0, 80))
      record(`路由可达 ${route.name} (${route.hash})`, true)
    } catch {
      text = await page.evaluate(() => (document.body.innerText || "").slice(0, 80))
      record(`路由可达 ${route.name} (${route.hash})`, false, `未出现「${route.expect}」，实际：${text.replace(/\s+/g, " ")}`)
    }
  }

  /* ---------- 2. 首屏图片真实加载（O-3 本地化验收） ---------- */
  await page.goto(base + "#/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => document.images.length > 0, null, { timeout: 8000 })
  const imgs = await page.evaluate(() =>
    [...document.images].map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth })),
  )
  const broken = imgs.filter((i) => i.w === 0)
  record("首屏图片全部加载成功", broken.length === 0, broken.map((b) => b.src).join(", ").slice(0, 120))

  /* ---------- 3. 未登录访问工作台只渲染引导卡（FR-AUTH-04） ---------- */
  await page.evaluate(() => localStorage.removeItem("hugow-admin-session-v1"))
  await page.goto(base + "#/admin/", { waitUntil: "domcontentloaded" })
  await page.waitForFunction(
    () => (document.body.innerText || "").includes("运营工作台需要登录"),
    null,
    { timeout: 10000 },
  )
  const blocked = await page.evaluate(() => ({
    hasSidebar: !!document.querySelector('[class*="sidebar"], nav[class*="w-"]'),
    hasIframe: !!document.querySelector("iframe"),
    text: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 120),
  }))
  record(
    "未登录拦截：引导卡且无侧栏/编辑区/预览",
    !blocked.hasSidebar && !blocked.hasIframe,
    JSON.stringify(blocked),
  )

  /* ---------- 4. 登录后工作台可进入（12 个标目 + 预览 iframe） ---------- */
  await page.evaluate((s) => {
    localStorage.setItem("hugow-admin-session-v1", JSON.stringify(s))
  }, SESSION)
  // 会话在页面初始化时读取，写完后必须重载当前页才会生效
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(
    () => (document.body.innerText || "").includes("总览"),
    null,
    { timeout: 30000 },
  )
  const admin = await page.evaluate(() => ({
    navCount: document.querySelectorAll("nav a, nav button").length,
    hasIframe: !!document.querySelector("iframe"),
    masked: (document.body.innerText || "").includes("…5f60"),
  }))
  record("登录后工作台可用", admin.navCount >= 10 && admin.hasIframe, JSON.stringify(admin))
  record("open_id 只露尾号", admin.masked)

  /* ---------- 5. 页面级异常 ---------- */
  record("无未捕获的页面异常", pageErrors.length === 0, pageErrors.join(" | ").slice(0, 160))

  await page.close()
} catch (err) {
  record("冒烟脚本异常中断", false, String(err).split("\n")[0].slice(0, 160))
} finally {
  await browser.close()
  server.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`)
process.exit(failed.length === 0 ? 0 : 1)
