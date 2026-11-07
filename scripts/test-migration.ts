/* 迁移模块单元测试。运行：node --experimental-strip-types scripts/test-migration.ts */

import assert from "node:assert/strict"

import {
  buildMigrationPackage,
  parseMigrationPackage,
  MIGRATION_SCHEMA_VERSION,
} from "../src/site/admin/data/migration.ts"

const cases: Array<[string, () => void]> = []
function t(name: string, fn: () => void): void {
  cases.push([name, fn])
}

t("构建包字段完整", () => {
  const pkg = buildMigrationPackage({ order: 1 }, { order: 0 }, 1234)
  assert.equal(pkg.exportedAt, 1234)
  assert.equal(pkg.schemaVersion, MIGRATION_SCHEMA_VERSION)
  assert.deepEqual(pkg.draft, { order: 1 })
  assert.deepEqual(pkg.published, { order: 0 })
})

t("序列化后可解析且内容一致", () => {
  const pkg = buildMigrationPackage({ hero: { x: 1 } as never }, {})
  const result = parseMigrationPackage(JSON.stringify(pkg))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.pkg.exportedAt, pkg.exportedAt)
  }
})

t("损坏 JSON 返回错误", () => {
  const result = parseMigrationPackage("{bad")
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.error.includes("JSON"))
})

t("版本不符返回错误", () => {
  const result = parseMigrationPackage(
    JSON.stringify({ schemaVersion: 99, draft: {}, published: {}, exportedAt: 1 }),
  )
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.error.includes("版本"))
})

t("缺 published 返回错误", () => {
  const result = parseMigrationPackage(
    JSON.stringify({ schemaVersion: 1, draft: {}, exportedAt: 1 }),
  )
  assert.equal(result.ok, false)
})

t("缺导出时间返回错误", () => {
  const result = parseMigrationPackage(
    JSON.stringify({ schemaVersion: 1, draft: {}, published: {} }),
  )
  assert.equal(result.ok, false)
})

let pass = 0
for (const [name, fn] of cases) {
  fn()
  pass += 1
  console.log("PASS ", name)
}
console.log(`\n合计 ${pass} 项，全部通过`)
