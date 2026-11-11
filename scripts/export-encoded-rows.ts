import { readFileSync } from "node:fs"

import { buildTableRows } from "@/server/table-rows"
import { encodeRecord, validateRecord } from "@/site/admin/data/table-schema"
import { TABLE_SPECS } from "@/site/admin/data/table-specs"

const draft = JSON.parse(readFileSync(process.env.DRAFT_JSON ?? "", "utf8")) as Record<string, unknown>
const rawRows = buildTableRows(draft)
const out: Record<string, unknown[]> = {}
const issues: unknown[] = []
for (const [table, rows] of Object.entries(rawRows)) {
  const spec = TABLE_SPECS[table]
  if (!spec) throw new Error(`missing spec: ${table}`)
  out[table] = rows.map((row) => {
    const encoded = encodeRecord(spec, row)
    issues.push(...validateRecord(spec, encoded))
    return encoded
  })
}
process.stdout.write(JSON.stringify({ rows: out, issues }, null, 2))
