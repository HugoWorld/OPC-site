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
 * 行尾统一：比较与写入都按 LF（\r\n → \n），避免 CRLF/LF 差异造成假漂移。
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

const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has("--check")
const FORCE = args.has("--force")

/** 在 _repo 内跑 git；git 不可用时返回 null（跳过安全检查） */
function gitPorcelain() {
  const r = spawnSync("git", ["-C", REPO_ROOT, "status", "--porcelain"], {
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
    const st = fs.statSync(path.join(absRoot, relPath))
    if (st.isDirectory()) listFiles(absRoot, relPath, out)
    else out.push(relPath)
  }
  return out
}

/** 收集 manifest 下全部相对路径 → { relPath: LF 归一化内容 } */
function collect(root) {
  const map = new Map()
  for (const d of MANIFEST_DIRS) {
    if (!fs.existsSync(path.join(root, d))) continue
    for (const rel of listFiles(root, d)) {
      map.set(rel, fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n"))
    }
  }
  for (const f of MANIFEST_FILES) {
    const abs = path.join(root, f)
    if (fs.existsSync(abs)) {
      map.set(f, fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n"))
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
const changed = [...src.keys()].filter((k) => repo.has(k) && src.get(k) !== repo.get(k)).sort()

if (CHECK_ONLY) {
  if (onlySrc.length === 0 && onlyRepo.length === 0 && changed.length === 0) {
    console.log(`check:sync 通过：prototype 与 _repo/OPC-site 一致（${src.size} 个文件）`)
    process.exit(0)
  }
  console.error("check:sync 失败：prototype 与 _repo/OPC-site 已漂移")
  for (const f of changed) console.error(`  内容不同：${f}`)
  for (const f of onlySrc) console.error(`  仅在 prototype：${f}`)
  for (const f of onlyRepo) console.error(`  仅在 _repo：${f}`)
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

for (const [rel, content] of src) {
  const dest = path.join(REPO_ROOT, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, content) // 已归一化为 LF
}
for (const rel of onlyRepo) {
  fs.rmSync(path.join(REPO_ROOT, rel))
}

console.log(
  `同步完成：写入/更新 ${src.size} 个，删除 _repo 独有 ${onlyRepo.length} 个` +
    (changed.length || onlySrc.length ? `（本次差异 ${changed.length + onlyRepo.length} 处）` : "（无差异）"),
)
console.log(`目标：${REPO_ROOT}`)
console.log("下一步：到 _repo/OPC-site 里 git diff 复核并 commit、push。")
