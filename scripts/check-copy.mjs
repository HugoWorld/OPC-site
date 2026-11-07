/**
 * 文案红线扫描（PRD FR-SAFE / O-7 最小回归的一部分）。
 *
 * 做三件事：
 * 1. 从构建产物中只提取「中文字符串片段」，避免把代码标识符当文案；
 * 2. 命中禁用词即失败（承诺结果类表述是红线）；
 * 3. 输出命中处的上下文，便于直接定位到源文案。
 *
 * 用法：node scripts/check-copy.mjs   （需先 npm run build）
 *
 * 判定口径：只拦「承诺结果 / 绝对化 / 贬低同行」的表述。
 * 形如「不保证结果」「你能保证吗」属于合规免责与提问，不拦。
 */
import fs from "node:fs"
import path from "node:path"

const DIST = path.resolve("dist")

/** 禁用词：用短语而非单字，避免把「不保证」「第一个月」这类正常表述误判为红线 */
const BANNED = [
  { label: "保证结果", re: /保证[^，。；]{0,3}(中标|通过|验收|效果|收益|成功|降本|提效|准确|安全|一定)/ },
  { label: "承诺结果", re: /承诺[^，。；]{0,3}(中标|通过|验收|效果|收益|成功|降本|提效|准确)/ },
  { label: "100%", re: /100\s?%|百分之百/ },
  { label: "零风险", re: /零风险|无风险/ },
  { label: "中标率", re: /中标率|中标保证/ },
  { label: "领先", re: /行业领先|领先于|领先水平|遥遥领先/ },
  { label: "首个", re: /行业首个|国内首个|全市首个|全国首个|首个(平台|系统|方案)/ },
  { label: "万无一失", re: /万无一失/ },
  { label: "绝对", re: /绝对(有效|可靠|安全|准确|领先)/ },
  { label: "最优", re: /最优解|最优方案|最佳效果/ },
  { label: "包过", re: /包过|必过|稳过|必中标|包中标/ },
  { label: "唯一", re: /唯一/ },
]

/** 白名单：正常技术用语与合规免责表述，先剔除再判定 */
const ALLOW = [
  /唯一\s?id/gi,
  /唯一键/g,
  /唯一性/g,
  /唯一行/g,
  /保证书/g,
  /不保证/g,
  /不能保证/g,
  /无法保证/g,
  /保证[^，。；]{0,8}吗/g,
  /不承诺/g,
  /不保证/g,
]

function listFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) listFiles(p, out)
    else if (/\.(js|css|html)$/.test(name)) out.push(p)
  }
  return out
}

/** 提取中文字符串片段：以汉字起头，后续最多 40 个非引号/括号字符 */
function extractChinese(text) {
  const re = /[\u4e00-\u9fa5]+(?:[^\u4e00-\u9fa5"'`<>{}]){0,40}/g
  return text.match(re) || []
}

const files = fs.existsSync(DIST) ? listFiles(DIST) : []
if (files.length === 0) {
  console.error("dist 不存在或无产物，请先执行 npm run build")
  process.exit(2)
}

const hits = []
for (const file of files) {
  let raw = fs.readFileSync(file, "utf8")
  for (const allow of ALLOW) raw = raw.replace(allow, "")
  for (const frag of extractChinese(raw)) {
    for (const rule of BANNED) {
      if (rule.re.test(frag)) {
        hits.push({ file: path.relative(DIST, file), rule: rule.label, ctx: frag.slice(0, 48) })
      }
    }
  }
}

if (hits.length === 0) {
  console.log(`文案红线扫描通过：${files.length} 个产物文件，无禁用词命中`)
  process.exit(0)
}

console.error(`文案红线扫描失败：${hits.length} 处命中`)
for (const h of hits.slice(0, 40)) {
  console.error(`  [${h.rule}] ${h.file} :: …${h.ctx}…`)
}
process.exit(1)
