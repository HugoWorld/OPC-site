/**
 * prototype → _repo/OPC-site 同步与一致性校验。
 *
 * 背景：prototype 是唯一真源码（自身不是 git 仓库），_repo/OPC-site 是它的
 * git 快照与开源仓库。两边靠本脚本保持一致，杜绝「手工拷贝导致单边漂移」。
 *
 * 用法：
 *   node scripts/sync-to-repo.mjs           # 同步（目标仓库有未提交改动时拒绝执行）
 *   node scripts/sync-to-repo.mjs --check   # 只校验一致性，发现漂移退出码 1
 *   node scripts/sync-to-repo.mjs --force   # 忽略目标仓库的未提交改动，强制同步
 *
 * 同步范围 = 下方 MANIFEST（src/、scripts/ 与构建配置）。
 * README / LICENSE / .github 属于开源仓库自己的文件，由 docs/repo/ 母本管理，不在此列。
 *
 * 行尾统一：文本文件比较与写入都按 LF（\r\n → \n）；图片等二进制按原始字节比较、
 * 原样写入，绝不能走 UTF-8 文本管道（否则会写入 EF BF BD 替换字符，直接损坏图片）。
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = path.resolve(HERE, "..")
const REPO_ROOT = path.resolve(SRC_ROOT, "../_repo/OPC-site")

const MANIFEST_DIRS = ["src", "scripts"]
const MANIFEST_FILES = [
  ".gitignore",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "components.json",
  "index.html",
  "admin.html",
]

/** 二进制扩展名：按字节比较与复制，不做 UTF-8 解码 */
const BINARY_EXT = new Set([
  ".png",
  ".webp",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".pdf",
  ".zip",
])

/** 本地源图不入库：仓库只保留站内使用的 webp 派生图 */
const MANIFEST_EXCLUDES = new Set([
  "src/site/assets/hero-avatar.png",
  "src/site/assets/hero-bg.png",
])

function isBinary(rel) {
  return BINARY_EXT.has(path.extname(rel).toLowerCase())
}

const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has("--check")
const FORCE = args.has("--force")

/** 在 _repo 内跑 git；优先显式 GIT_EXE，其次本机便携 git，最后 PATH 里的 git */
function gitBinary() {
  if (process.env.GIT_EXE && fs.existsSync(process.env.GIT_EXE)) return process.env.GIT_EXE
  const portable = path.resolve(SRC_ROOT, "../_tools/mingit/cmd/git.exe")
  if (fs.existsSync(portable)) return portable
  return "git"
}

/** git 不可用时返回 null（跳过安全检查） */
function gitPorcelain() {
  const r = spawnSync(gitBinary(), ["-C", REPO_ROOT, "status", "--porcelain"], {
    encoding: "utf8",
  })
  if (r.error || r.status !== 0) return null
  return r.stdout.trim()
}

function listFiles(absRoot, rel = "", out = []) {
  const dir = path.join(absRoot, rel)
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue
    const relPath = rel ? `${rel}/${name}` : name
    if (MANIFEST_EXCLUDES.has(relPath)) continue
    const st = fs.statSync(path.join(absRoot, relPath))
    if (st.isDirectory()) listFiles(absRoot, relPath, out)
    else out.push(relPath)
  }
  return out
}

/** 读取一个 manifest 文件：二进制保留 Buffer，文本按 LF 归一化 */
function readEntry(root, rel) {
  const abs = path.join(root, rel)
  if (isBinary(rel)) {
    const data = fs.readFileSync(abs)
    return { kind: "binary", data }
  }
  return {
    kind: "text",
    data: fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n"),
  }
}

/** 二进制魔数校验：防止同步/拷贝把图片写成 UTF-8 替换字符 */
function binaryLooksValid(rel, data) {
  // UTF-8 文本管道会把 >=0x80 的字节替换成 EF BF BD，这是最常见的损坏特征
  if (data.includes(Buffer.from([0xef, 0xbf, 0xbd]))) return false
  const ext = path.extname(rel).toLowerCase()
  if (ext === ".png") {
    return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (ext === ".webp") {
    if (data.length < 16) return false
    if (data.subarray(0, 4).toString("ascii") !== "RIFF") return false
    if (data.subarray(8, 12).toString("ascii") !== "WEBP") return false
    // RIFF 头里的文件长度必须与实际长度一致（损坏文件的长度字段会被写成乱码）
    const declared = data.readUInt32LE(4) + 8
    return Math.abs(declared - data.length) <= 1
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  }
  return true
}

/** 比较两个 manifest 条目：二进制逐字节，文本逐字符 */
function sameEntry(a, b) {
  if (a.kind !== b.kind) return false
  if (a.kind === "binary") return Buffer.compare(a.data, b.data) === 0
  return a.data === b.data
}

/** 收集 manifest 下全部相对路径 → entry */
function collect(root) {
  const map = new Map()
  for (const d of MANIFEST_DIRS) {
    if (!fs.existsSync(path.join(root, d))) continue
    for (const rel of listFiles(root, d)) {
      map.set(rel, readEntry(root, rel))
    }
  }
  for (const f of MANIFEST_FILES) {
    const abs = path.join(root, f)
    if (fs.existsSync(abs)) {
      map.set(f, readEntry(root, f))
    }
  }
  return map
}

if (!fs.existsSync(REPO_ROOT)) {
  // 在 _repo/OPC-site 自身的检出里运行时没有目标目录：跳过（CI 场景）。
  console.log(
    CHECK_ONLY
      ? "check:sync 跳过：当前不在 prototype 工作区（未找到 ../_repo/OPC-site）"
      : "同步跳过：未找到 ../_repo/OPC-site",
  )
  process.exit(0)
}

const src = collect(SRC_ROOT)
const repo = collect(REPO_ROOT)

const onlySrc = [...src.keys()].filter((k) => !repo.has(k)).sort()
const onlyRepo = [...repo.keys()].filter((k) => !src.has(k)).sort()
const changed = [...src.keys()]
  .filter((k) => repo.has(k) && !sameEntry(src.get(k), repo.get(k)))
  .sort()
const corrupt = [...repo.keys()]
  .filter((k) => repo.get(k).kind === "binary" && !binaryLooksValid(k, repo.get(k).data))
  .sort()
// 约定不入库的源图若出现在仓库，同样算漂移（collect 会跳过它们，必须单独查）
const stray = [...MANIFEST_EXCLUDES]
  .filter((k) => fs.existsSync(path.join(REPO_ROOT, k)))
  .sort()

if (CHECK_ONLY) {
  if (onlySrc.length === 0 && onlyRepo.length === 0 && changed.length === 0 && corrupt.length === 0 && stray.length === 0) {
    console.log(`check:sync 通过：prototype 与 _repo/OPC-site 一致（${src.size} 个文件）`)
    process.exit(0)
  }
  console.error("check:sync 失败：prototype 与 _repo/OPC-site 已漂移")
  for (const f of changed) console.error(`  内容不同：${f}`)
  for (const f of onlySrc) console.error(`  仅在 prototype：${f}`)
  for (const f of onlyRepo) console.error(`  仅在 _repo：${f}`)
  for (const f of corrupt) console.error(`  二进制损坏：${f}`)
  for (const f of stray) console.error(`  不应入库：${f}`)
  console.error("修复：npm run sync:repo（同步到 _repo）")
  process.exit(1)
}

/* ---- 同步模式 ---- */
const dirty = gitPorcelain()
if (dirty && !FORCE) {
  console.error("同步中止：_repo/OPC-site 有未提交改动（可能是另一会话在操作）。")
  console.error(dirty)
  console.error("先提交/暂存后再同步，或确认无误后用 --force。")
  process.exit(1)
}

for (const [rel, entry] of src) {
  const dest = path.join(REPO_ROOT, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  // Buffer 原样写入；文本已归一化为 LF
  fs.writeFileSync(dest, entry.data)
}
for (const rel of onlyRepo) {
  fs.rmSync(path.join(REPO_ROOT, rel))
}
// 源图不入库：即使之前误同步进仓库，也在同步时清掉
for (const rel of MANIFEST_EXCLUDES) {
  const dest = path.join(REPO_ROOT, rel)
  if (fs.existsSync(dest)) fs.rmSync(dest)
}

console.log(
  `同步完成：写入/更新 ${src.size} 个，删除 _repo 独有 ${onlyRepo.length} 个` +
    (changed.length || onlySrc.length ? `（本次差异 ${changed.length + onlyRepo.length} 处）` : "（无差异）"),
)
console.log(`目标：${REPO_ROOT}`)
console.log("下一步：到 _repo/OPC-site 里 git diff 复核并 commit、push。")
