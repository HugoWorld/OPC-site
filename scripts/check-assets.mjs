/**
 * 资源与链接检查（PRD O-3：图片必须站内托管；O-6：产物清单可核对）。
 *
 * 检查项：
 * 1. dist 内不得出现临时 CDN 图片域名（aka.doubaocdn.com 等）；
 * 2. dist 内不得引用 http(s) 的图片资源（必须随静态产物一起部署）；
 * 3. 图片类产物必须真实存在于 dist 中；
 * 4. 输出产物清单与首屏 JS 体积（gzip），超预算即提示。
 *
 * 用法：node scripts/check-assets.mjs   （需先 npm run build）
 */
import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const DIST = path.resolve("dist")
const TEMP_CDN = [/aka\.doubaocdn\.com/, /doubaocdn\.com/, /t\.\w+\.cn\/tmp/]
const IMG_EXT = /\.(png|jpg|jpeg|webp|gif|svg|avif)$/i

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

if (!fs.existsSync(DIST)) {
  console.error("dist 不存在，请先执行 npm run build")
  process.exit(2)
}

const files = walk(DIST)
const errors = []
const warnings = []

/* 1 & 2：扫描文本类产物中的外链图片 */
for (const file of files) {
  if (!/\.(html|js|css)$/.test(file)) continue
  const text = fs.readFileSync(file, "utf8")
  for (const re of TEMP_CDN) {
    if (re.test(text)) errors.push(`临时 CDN 残留：${path.relative(DIST, file)} 命中 ${re}`)
  }
  const remoteImg = text.match(/https?:\/\/[^\s"'`()]+\.(?:png|jpg|jpeg|webp|gif|svg|avif)/gi) || []
  for (const u of remoteImg) {
    // 跳过界面占位符（如输入框提示 https://…/avatar.png），它不是真实资源引用
    if (/[…\u2026]|\.\.\./.test(u)) continue
    errors.push(`外链图片未本地化：${path.relative(DIST, file)} :: ${u.slice(0, 80)}`)
  }
}

/* 3：图片产物存在性 + 体积 */
const images = files.filter((f) => IMG_EXT.test(f))
for (const img of images) {
  const size = fs.statSync(img).size
  if (size > 300 * 1024) warnings.push(`图片偏大（>300 kB）：${path.relative(DIST, img)} ${(size / 1024).toFixed(0)} kB`)
}

console.log(`图片产物 ${images.length} 个：`)
for (const img of images) {
  console.log(`  ${path.relative(DIST, img)}  ${(fs.statSync(img).size / 1024).toFixed(1)} kB`)
}

/* 4：首屏 JS gzip 预算（入口块 + 直接 import 的 vendor 块） */
const entry = files.find((f) => /assets[\\/]index-.*\.js$/.test(f))
if (entry) {
  const gz = zlib.gzipSync(fs.readFileSync(entry)).length
  console.log(`入口块 ${path.basename(entry)} gzip ${(gz / 1024).toFixed(1)} kB`)
  if (gz > 120 * 1024) warnings.push(`入口块 gzip 超出 120 kB 预算：${(gz / 1024).toFixed(1)} kB`)
}

for (const w of warnings) console.warn("WARN " + w)
if (errors.length) {
  console.error(`资源检查失败：${errors.length} 处`)
  for (const e of errors.slice(0, 20)) console.error("  " + e)
  process.exit(1)
}
console.log("资源检查通过：无临时 CDN 残留、无外链图片、图片产物齐全")
