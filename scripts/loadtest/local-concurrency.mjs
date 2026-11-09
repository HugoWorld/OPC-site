/**
 * 本地并发冒烟（无需 k6）：对构建产物做固定并发请求，统计状态码与分位延迟。
 *
 * 它验证的是「静态产物在本机 HTTP 服务下能否稳定并发响应」，不是 CDN 容量；
 * 真实承载数字仍以 scripts/loadtest/visitor.k6.js 在目标 CDN 上跑出的为准。
 *
 * 用法：
 *   node scripts/loadtest/local-concurrency.mjs --url http://localhost:4173 --requests 1000 --concurrency 100
 */
import process from "node:process"

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name)
  return i > 0 ? process.argv[i + 1] : fallback
}

const base = arg("url", "http://localhost:4173").replace(/\/$/, "")
const requests = Number(arg("requests", "500"))
const concurrency = Number(arg("concurrency", "50"))
const timeoutMs = Number(arg("timeout", "10000"))

async function one(i) {
  const started = performance.now()
  try {
    const res = await fetch(`${base}/?load=${i}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "accept-encoding": "gzip" },
    })
    await res.arrayBuffer()
    return { status: res.status, ms: performance.now() - started }
  } catch (e) {
    return { status: 0, ms: performance.now() - started, error: String(e) }
  }
}

let next = 0
const results = []
async function worker() {
  while (next < requests) {
    const i = next
    next += 1
    results.push(await one(i))
  }
}

const startedAll = performance.now()
await Promise.all(Array.from({ length: concurrency }, worker))
const wall = performance.now() - startedAll

const ok = results.filter((r) => r.status === 200).length
const failed = results.filter((r) => r.status !== 200)
const ms = results.map((r) => r.ms).sort((a, b) => a - b)
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))]

console.log(`请求 ${requests}，并发 ${concurrency}，总耗时 ${(wall / 1000).toFixed(2)} s`)
console.log(`200: ${ok}，非 200: ${failed.length}`)
console.log(
  `延迟 p50 ${pct(50).toFixed(0)} ms / p95 ${pct(95).toFixed(0)} ms / p99 ${pct(99).toFixed(0)} ms`,
)
console.log(`吞吐 ${(requests / (wall / 1000)).toFixed(0)} req/s（本机循环，不等于 CDN 容量）`)

if (failed.length > 0) {
  const codes = new Map()
  for (const f of failed) codes.set(f.status || "ERR", (codes.get(f.status || "ERR") ?? 0) + 1)
  console.error("失败分布:", Object.fromEntries(codes))
  process.exit(1)
}
