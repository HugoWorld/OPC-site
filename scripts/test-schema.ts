/* ------------------------------------------------------------------ */
/* 数据层单元测试。运行：node --experimental-strip-types                 */
/* scripts/test-schema.ts（Node 22 原生剥离 TS，无需额外依赖）。         */
/* ------------------------------------------------------------------ */

import assert from "node:assert/strict"

import {
  encodeCell,
  decodeCell,
  encodeRecord,
  validateRecord,
  SOLUTIONS_TABLE,
  encodeSolutions,
  decodeSolutions,
} from "../src/site/admin/data/table-schema.ts"
import {
  LocalAdapter,
  MockAdapter,
  type StorageLike,
} from "../src/site/admin/data/adapter.ts"
import { readSnapshot } from "../src/site/admin/data/snapshot.ts"
import { SOLUTIONS } from "../src/site/data/solutions.ts"

let pass = 0
function check(name: string, fn: () => void): void {
  fn()
  pass += 1
  console.log("PASS ", name)
}

/* ---------- 单元格编解码 ---------- */

check("multiline 编码：去空行、去空白、换行连接", () => {
  assert.equal(encodeCell("multiline", ["a", "", " b "]), "a\nb")
})

check("multiline 解码：拆分、trim、去空行", () => {
  assert.deepEqual(decodeCell("multiline", "a\n\nb\n"), ["a", "b"])
})

check("bool 编解码", () => {
  assert.equal(encodeCell("bool", true), true)
  assert.equal(decodeCell("bool", false), false)
  assert.equal(decodeCell("bool", "true"), false)
})

check("number 编码：字符串数字转换，非法回落 0", () => {
  assert.equal(encodeCell("number", "3"), 3)
  assert.equal(encodeCell("number", "x"), 0)
})

check("json 损坏时安全返回 null", () => {
  assert.equal(decodeCell("json", "{bad"), null)
  assert.equal(decodeCell("json", ""), null)
})

/* ---------- 校验 ---------- */

check("必填缺失返回 SCHEMA_REQUIRED", () => {
  const issues = validateRecord(SOLUTIONS_TABLE, { title: "x" })
  assert.ok(issues.some((i) => i.code === "SCHEMA_REQUIRED" && i.field === "id"))
})

check("非 https 链接返回 SCHEMA_URL_INSECURE", () => {
  const spec = {
    ...SOLUTIONS_TABLE,
    fields: [{ name: "link", kind: "url" as const, required: true }],
  }
  const issues = validateRecord(spec, { id: "r1", link: "http://x" })
  assert.equal(issues[0].code, "SCHEMA_URL_INSECURE")
})

check("不存在的日期返回 SCHEMA_DATE（含 2 月 30 日）", () => {
  const spec = {
    ...SOLUTIONS_TABLE,
    fields: [{ name: "date", kind: "date" as const }],
  }
  assert.equal(validateRecord(spec, { id: "r1", date: "2026-02-30" })[0].code, "SCHEMA_DATE")
  assert.equal(validateRecord(spec, { id: "r1", date: "2026-13-01" })[0].code, "SCHEMA_DATE")
})

check("合法记录零 issue", () => {
  const record = encodeRecord(SOLUTIONS_TABLE, {
    id: "r1",
    tier: "主推",
    title: "示例",
    capabilities: ["a", "b"],
    order: 2,
    published: true,
    body: [{ heading: "h", paragraphs: [] }],
  })
  assert.equal(validateRecord(SOLUTIONS_TABLE, record).length, 0)
})

/* ---------- 真实数据往返 ---------- */

check("真实 SOLUTIONS 编码后全部通过校验", () => {
  const records = encodeSolutions(SOLUTIONS)
  for (const record of records) {
    assert.equal(validateRecord(SOLUTIONS_TABLE, record).length, 0)
  }
})

check("真实 SOLUTIONS 解码往返字段一致", () => {
  const back = decodeSolutions(encodeSolutions(SOLUTIONS))
  assert.equal(back.length, SOLUTIONS.length)
  SOLUTIONS.forEach((s, i) => {
    const b = back[i]
    assert.equal(b.id, s.id)
    assert.deepEqual(b.capabilities, s.capabilities)
    assert.deepEqual(b.deliverables, s.deliverables)
    assert.deepEqual(b.boundaries, s.boundaries)
    assert.deepEqual(b.stack, s.stack)
    assert.equal(b.order, s.order)
    assert.equal(b.published, s.published !== false)
    assert.equal(b.body.length, s.body.length)
    assert.equal(b.demo.status, s.demo.status)
    assert.equal(b.demo.duration, s.demo.duration)
  })
})

/* ---------- 适配器 ---------- */

class MemStorage implements StorageLike {
  private readonly m = new Map<string, string>()
  getItem(key: string): string | null {
    return this.m.has(key) ? this.m.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.m.set(key, value)
  }
  removeItem(key: string): void {
    this.m.delete(key)
  }
}

check("LocalAdapter：发布后可读取已发布覆盖", async () => {
  const adapter = new LocalAdapter({
    draftKey: "d",
    publishedKey: "p",
    storage: new MemStorage(),
  })
  const result = await adapter.publish({ order: 1 } as never)
  assert.equal(result.status, "ok")
  const loaded = await adapter.load()
  assert.equal(loaded.source, "local")
  assert.equal((loaded.overrides as { order: number }).order, 1)
})

check("MockAdapter：成功发布后读取来源为 remote", async () => {
  const adapter = new MockAdapter({ latencyMs: 1 })
  const result = await adapter.publish({ order: 2 } as never)
  assert.equal(result.status, "ok")
  const loaded = await adapter.load()
  assert.equal(loaded.source, "remote")
  assert.ok(loaded.version?.startsWith("mock-"))
})

check("MockAdapter：失败表返回 failed 且不伪成功", async () => {
  const adapter = new MockAdapter({ failTables: ["solutions"] })
  const result = await adapter.publish({ order: 3 } as never)
  assert.equal(result.status, "failed")
  if (result.status === "failed") {
    assert.equal(result.failedTables[0].table, "solutions")
    assert.equal(result.failedTables[0].retryable, true)
  }
})

/* ---------- 快照 ---------- */

check("readSnapshot：两步读取成功", async () => {
  const files: Record<string, unknown> = {
    "./data/current.json": { releaseId: "r1" },
    "./data/snapshot-r1.json": {
      version: "r1",
      generatedAt: 123,
      data: { order: 9 },
    },
  }
  const fetchImpl = (async (url: string) => ({
    ok: true,
    json: async () => files[String(url)],
  })) as typeof fetch

  const envelope = await readSnapshot({ fetchImpl, timeoutMs: 1000 })
  assert.notEqual(envelope, null)
  assert.equal(envelope!.version, "r1")
})

check("readSnapshot：端点失败时返回 null", async () => {
  const fetchImpl = (async () => ({ ok: false, json: async () => null })) as typeof fetch
  const envelope = await readSnapshot({ fetchImpl, timeoutMs: 1000 })
  assert.equal(envelope, null)
})

console.log(`\n合计 ${pass} 项，全部通过`)
