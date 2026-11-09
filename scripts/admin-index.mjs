/**
 * 管理台构建收尾：把 dist-admin/admin.html 复制为 index.html。
 * 部署到 admin 子域时根路径 `/` 直接命中工作台，不需要额外 rewrite。
 * 同时保留 admin.html，便于同域调试时用 /admin.html 访问。
 *
 * 用法：node scripts/admin-index.mjs（在 vite build --mode admin 之后）
 */
import fs from "node:fs"
import path from "node:path"

const dir = path.resolve("dist-admin")
const from = path.join(dir, "admin.html")
const to = path.join(dir, "index.html")

if (!fs.existsSync(from)) {
  console.error("dist-admin/admin.html 不存在，请先执行 vite build --mode admin")
  process.exit(2)
}

fs.copyFileSync(from, to)
console.log("已生成 dist-admin/index.html（管理台根入口）")
