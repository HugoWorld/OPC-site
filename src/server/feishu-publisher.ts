/* ------------------------------------------------------------------ */
/* 真实发布服务：草稿 → 12 张 Base 表 → 本机快照。                       */
/*                                                                    */
/* 发布语义：                                                            */
/* - 每张表按主键 upsert，并删除「本次不在表里」的旧行（audit_log 除外）； */
/* - 任意表失败 → 不切换 current.json，前台继续读上一份完整快照；         */
/* - 全部表成功 → 写不可变版本文件 + 原子切换指针 → 前台可见；            */
/* - audit_log 追加一条发布记录，失败只告警，不阻断发布。                 */
/* ------------------------------------------------------------------ */

import type { PublishResult, TableFailure } from "../site/admin/data/adapter.ts"
import type { PublishService, SessionPayload } from "./gateway.ts"
import type { SnapshotEnvelope } from "../site/admin/data/snapshot.ts"
import type { TableSpec, TableRecord } from "../site/admin/data/table-schema.ts"
import { encodeRecord, validateRecord } from "../site/admin/data/table-schema.ts"
import { FEISHU_TABLE_IDS, TABLE_SPECS } from "../site/admin/data/table-specs.ts"
import { buildTableRows } from "./table-rows.ts"
import type { FeishuBitable, BitableRecord } from "./feishu-bitable.ts"
import { FeishuApiError } from "./feishu-api.ts"
import type { LocalSnapshotService } from "./local-snapshot.ts"
import { createReleaseId } from "./local-snapshot.ts"

export interface FeishuPublisherOptions {
  bitable: FeishuBitable
  snapshots: LocalSnapshotService
  /** 显式指定表名 → table_id；不传则从 Base 按表名自动发现。 */
  tableIds?: Record<string, string>
  /** 发布审计里的目标描述 */
  targetLabel?: string
  now?: () => number
}

export function parseTableIds(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim()
    }
    return Object.keys(out).length > 0 ? out : undefined
  } catch {
    return undefined
  }
}

/** Base 表名允许大小写、空格、短横线差异；模板复制后仍能对上。 */
export function normalizeTableName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\w\u4e00-\u9fff]/g, "")
}

export interface TableIdResolution {
  ids: Record<string, string>
  missing: string[]
  discovered: boolean
  error?: string
}

/**
 * 解析 12 张表的真实 table_id。
 * 顺序：显式配置 → Base 表名 → 内置坐标兜底（仅用于 HugoW 自有 Base）。
 * 兜底不能让复制模板的用户误连到原作者的 Base；表名对不上时报缺表。
 */
export async function resolveTableIds(
  bitable: FeishuBitable,
  explicit?: Record<string, string>,
): Promise<TableIdResolution> {
  const ids: Record<string, string> = {}
  const missing: string[] = []
  let discovered = false
  let error: string | undefined

  if (explicit && Object.keys(explicit).length > 0) {
    for (const spec of Object.values(TABLE_SPECS)) {
      const hit = explicit[spec.table]
      if (hit) ids[spec.table] = hit
      else missing.push(spec.table)
    }
    return { ids, missing, discovered: false }
  }

  if (!bitable.isConfigured()) {
    return {
      ids,
      missing: Object.values(TABLE_SPECS).map((spec) => spec.table),
      discovered: false,
      error: "未配置 BITABLE_APP_TOKEN",
    }
  }

  try {
    const tables = await bitable.listTables()
    const byName = new Map<string, string>()
    for (const table of tables) {
      byName.set(normalizeTableName(table.name), table.tableId)
    }
    discovered = byName.size > 0
    for (const spec of Object.values(TABLE_SPECS)) {
      const discoveredId = byName.get(normalizeTableName(spec.table))
      ids[spec.table] = discoveredId ?? ""
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
    // 读取表清单失败时保留内置坐标，至少不改变原有单 Base 的行为。
    for (const spec of Object.values(TABLE_SPECS)) {
      ids[spec.table] = FEISHU_TABLE_IDS[spec.table] ?? ""
    }
  }

  for (const spec of Object.values(TABLE_SPECS)) {
    if (!ids[spec.table]) missing.push(spec.table)
  }
  return { ids, missing, discovered, error }
}

function isRetryable(err: unknown): boolean {
  if (!(err instanceof FeishuApiError)) return true
  // 权限 / 参数 / 应用不可用类不重试；限流与网络类可重试。
  return !(
    err.code === 91403 ||
    err.code === 99991672 ||
    err.code === 21001 ||
    err.code === 20029 ||
    err.code === 20035
  )
}

function failure(table: string, err: unknown, fallbackCode = "PWB_TABLE_FAILED"): TableFailure {
  if (err instanceof FeishuApiError) {
    return {
      table,
      code: `FEISHU_${err.code}`,
      message: err.message,
      retryable: isRetryable(err),
    }
  }
  return {
    table,
    code: fallbackCode,
    message: err instanceof Error ? err.message : String(err),
    retryable: true,
  }
}

/** 主键单元格可能是字符串、数字、数组或对象，统一成可比较的字符串。 */
function cellKey(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === "string" || typeof v === "number") return String(v)
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>
          return String(o.text ?? o.name ?? o.value ?? "")
        }
        return ""
      })
      .join("")
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>
    return String(o.text ?? o.name ?? o.value ?? "")
  }
  return String(value)
}

interface TableWriteResult {
  written: number
  failure?: TableFailure
}

async function writeTable(
  bitable: FeishuBitable,
  spec: TableSpec,
  tableId: string,
  sourceRows: TableRecord[],
): Promise<TableWriteResult> {
  const encoded = sourceRows.map((row) => encodeRecord(spec, row))
  const issues = encoded.flatMap((row) => validateRecord(spec, row))
  if (issues.length > 0) {
    const first = issues[0]
    return {
      written: 0,
      failure: {
        table: spec.table,
        code: `SCHEMA_${first.code}`,
        message: `${issues.length} 个字段校验失败；首个：${first.field} ${first.message}`,
        retryable: false,
      },
    }
  }

  let existing: BitableRecord[]
  try {
    existing = await bitable.listRecords(tableId)
  } catch (err) {
    return { written: 0, failure: failure(spec.table, err, "PWB_READ_FAILED") }
  }

  const byKey = new Map<string, BitableRecord>()
  for (const record of existing) {
    const key = cellKey(record.fields[spec.primaryKey])
    if (key) byKey.set(key, record)
  }

  const seen = new Set<string>()
  let written = 0
  for (const row of encoded) {
    const key = cellKey(row[spec.primaryKey])
    seen.add(key)
    try {
      const hit = byKey.get(key)
      if (hit) {
        await bitable.updateRecord(tableId, hit.record_id, row)
      } else {
        await bitable.createRecord(tableId, row)
      }
      written += 1
    } catch (err) {
      return { written, failure: failure(spec.table, err) }
    }
  }

  // 清理本次未出现的旧行；audit_log 由 publish 单独追加，不走这里。
  for (const [key, record] of byKey) {
    if (seen.has(key)) continue
    try {
      await bitable.deleteRecord(tableId, record.record_id)
    } catch (err) {
      return { written, failure: failure(spec.table, err, "PWB_DELETE_FAILED") }
    }
  }

  return { written }
}

async function appendAudit(
  bitable: FeishuBitable,
  tableId: string | undefined,
  operator: SessionPayload,
  result: "ok" | "partial" | "failed",
  target: string,
  at: number,
): Promise<void> {
  if (!tableId) return
  try {
    const records = await bitable.listRecords(tableId)
    let maxSeq = 0
    for (const record of records) {
      const seq = Number(record.fields.seq)
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq
    }
    await bitable.createRecord(tableId, {
      seq: maxSeq + 1,
      openId: operator.openId,
      at: new Date(at).toISOString(),
      result,
      target,
      action: "publish",
    })
  } catch (err) {
    // 审计失败不阻断发布，但必须留下服务端告警。
    console.error("[gateway] audit_log 写入失败", {
      code: err instanceof FeishuApiError ? err.code : "unknown",
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

export function createFeishuPublisher(opts: FeishuPublisherOptions): PublishService {
  const now = opts.now ?? (() => Date.now())
  const targetLabel = opts.targetLabel ?? "12 张业务表"

  return {
    async publish(draft, operator): Promise<PublishResult> {
      const at = now()
      const rowsByTable = buildTableRows(draft as Record<string, unknown>)
      const writtenTables: string[] = []
      const failedTables: TableFailure[] = []

      const tables = Object.keys(rowsByTable)
      const resolution = await resolveTableIds(opts.bitable, opts.tableIds)
      for (const table of tables) {
        const spec = TABLE_SPECS[table]
        const tableId = resolution.ids[table]
        if (!spec) {
          failedTables.push({
            table,
            code: "TABLE_NOT_CONFIGURED",
            message: `缺少 ${table} 的表契约`,
            retryable: false,
          })
          continue
        }
        if (!tableId) {
          failedTables.push({
            table,
            code: "TABLE_NOT_FOUND",
            message:
              `Base 中找不到表「${table}」` +
              (resolution.error ? `（读取表清单失败：${resolution.error}）` : "") +
              "；请确认已复制模板 Base，并把应用加入该 Base 的文档应用。",
            retryable: false,
          })
          continue
        }
        const result = await writeTable(opts.bitable, spec, tableId, rowsByTable[table])
        if (result.failure) failedTables.push(result.failure)
        else writtenTables.push(table)
      }

      if (writtenTables.length === 0) {
        await appendAudit(opts.bitable, resolution.ids.audit_log, operator, "failed", targetLabel, at)
        return { status: "failed", failedTables }
      }

      if (failedTables.length > 0) {
        await appendAudit(opts.bitable, resolution.ids.audit_log, operator, "partial", targetLabel, at)
        return { status: "partial", writtenTables, failedTables }
      }

      const version = createReleaseId(at)
      const envelope: SnapshotEnvelope = {
        version,
        generatedAt: at,
        operatorSuffix: operator.openId.slice(-4),
        data: draft as SnapshotEnvelope["data"],
      }
      try {
        await opts.snapshots.publish(envelope)
      } catch (err) {
        return {
          status: "partial",
          writtenTables,
          failedTables: [failure("snapshot", err, "SNAP_WRITE_FAILED")],
        }
      }

      await appendAudit(opts.bitable, resolution.ids.audit_log, operator, "ok", targetLabel, at)
      return { status: "ok", version, writtenTables, at }
    },
  }
}
