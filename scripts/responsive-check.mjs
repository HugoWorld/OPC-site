/**
 * 响应式核验：移动端 375 与桌面端 1280 下，
 * 关键路由无横向溢出、H1 正常渲染。
 */
import { chromium } from "playwright-core"

const BASE = `http://127.0.0.1:${Number(process.env.SMOKE_PORT || 5173)}/`
const ROUTES = [
  ["#/", "首页"],
  ["#/solutions/", "能力模块"],
  ["#/writing/", "文章"],
  ["#/contact/", "联系"],
  ["#/privacy/", "隐私"],
]
const VIEWPORTS = [
  { width: 375, height: 812, name: "移动 375" },
  { width: 1280, height: 900, name: "桌面 1280" },
]

const results = []
function record(name, ok, detail = "") {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  :: " + detail : ""}`)
}

const browser = await chromium.launch({ channel: "chrome", headless: true })
try {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await context.newPage()
    for (const [hash, label] of ROUTES) {
      await page.goto(BASE + hash, { waitUntil: "domcontentloaded" })
      await page.waitForTimeout(700)
      const info = await page.evaluate(() => ({
        h1: document.querySelector("h1")?.textContent?.trim()?.slice(0, 20) || "",
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        vw: window.innerWidth,
      }))
      const ok = info.overflow <= 1 && info.h1.length > 0
      record(`${vp.name} · ${label}`, ok, `溢出=${info.overflow}px H1=${info.h1}`)
    }
    await context.close()
  }
} catch (err) {
  record("响应式脚本异常中断", false, String(err).split("\n")[0])
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n合计 ${results.length} 项，通过 ${results.length - failed.length} 项，失败 ${failed.length} 项`)
process.exit(failed.length === 0 ? 0 : 1)
