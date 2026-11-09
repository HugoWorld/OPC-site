/* ------------------------------------------------------------------ */
/* 发布互斥测试：keyed mutex + 快照指针 CAS                             */
/* 运行：node --experimental-strip-types scripts/test-publish-guard.ts  */
/* ------------------------------------------------------------------ */

import assert from "node:assert/strict"

import {
  createKeyedMutex,
  publishSnapshotWithCas,
  type VersionPointerStore,
} from "../src/server/publish-guard.ts"

let pass = 0
const cases: Array<[string, () => Promise<void>]> = []
function t(name: string, fn: () => Promise<void>): void {
  cases.push([name, fn])
}

t("同一 key 的任务串行执行", async () => {
  const run = createKeyedMutex()
  const log: string[] = []
  const slow = () =>
    run("publish", async () => {
      log.push("a-start")
      await new Promise((r) => setTimeout(r, 30))
      log.push("a-end")
    })
  const fast = () =>
    run("publish", async () => {
      log.push("b-start")
      log.push("b-end")
    })
  await Promise.all([slow(), fast()])
  assert.deepEqual(log, ["a-start", "a-end", "b-start", "b-end"])
})

t("前一个任务失败不阻塞后续任务", async () => {
  const run = createKeyedMutex()
  await assert.rejects(run("k", async () => { throw new Error("boom") }))
  const result = await run("k", async () => "ok")
  assert.equal(result, "ok")
})

t("不同 key 互不阻塞", async () => {
  const run = createKeyedMutex()
  const order: string[] = []
  await Promise.all([
    run("a", async () => {
      await new Promise((r) => setTimeout(r, 20))
      order.push("a")
    }),
    run("b", async () => {
      order.push("b")
    }),
  ])
  assert.deepEqual(order, ["b", "a"])
})

function memoryStore(initial: string | null): VersionPointerStore & { current: string | null } {
  const state = {
    current: initial,
    async getCurrent() {
      return state.current
    },
    async compareAndSwap(expected: string | null, next: string) {
      if (state.current !== expected) return false
      state.current = next
      return true
    },
  }
  return state
}

t("指针未被改动时 CAS 成功且先写版本文件", async () => {
  const store = memoryStore("v1")
  const order: string[] = []
  const outcome = await publishSnapshotWithCas({
    expected: "v1",
    next: "v2",
    store,
    writeVersionFile: async (v) => {
      order.push("write-" + v)
    },
  })
  assert.equal(outcome.status, "ok")
  assert.equal(store.current, "v2")
  assert.deepEqual(order, ["write-v2"])
})

t("并发发布时落后的一方拿到冲突", async () => {
  const store = memoryStore("v1")
  // 模拟两个发布者都读到 v1，A 先切换成功。
  const a = await publishSnapshotWithCas({
    expected: "v1",
    next: "v2",
    store,
    writeVersionFile: async () => {},
  })
  const b = await publishSnapshotWithCas({
    expected: "v1",
    next: "v3",
    store,
    writeVersionFile: async () => {},
  })
  assert.equal(a.status, "ok")
  assert.deepEqual(b, { status: "conflict", current: "v2" })
})

t("首次发布 expected 为 null 时可行", async () => {
  const store = memoryStore(null)
  const outcome = await publishSnapshotWithCas({
    expected: null,
    next: "v1",
    store,
    writeVersionFile: async () => {},
  })
  assert.equal(outcome.status, "ok")
  assert.equal(store.current, "v1")
})

for (const [name, fn] of cases) {
  await fn()
  pass += 1
  console.log("PASS ", name)
}
console.log(`\n合计 ${pass} 项，全部通过`)
