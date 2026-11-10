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
  /** 发布审计里的目标描述 */
  targetLabel?: string
  now?: () => number
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
  operator: SessionPayload,
  result: "ok" | "partial" | "failed",
  target: string,
  at: number,
): Promise<void> {
  const tableId = FEISHU_TABLE_IDS.audit_log
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
      for (const table of tables) {
        const spec = TABLE_SPECS[table]
        const tableId = FEISHU_TABLE_IDS[table]
        if (!spec || !tableId) {
          failedTables.push({
            table,
            code: "TABLE_NOT_CONFIGURED",
            message: `缺少 ${table} 的表契约或 table_id`,
            retryable: false,
          })
          continue
        }
        const result = await writeTable(opts.bitable, spec, tableId, rowsByTable[table])
        if (result.failure) failedTables.push(result.failure)
        else writtenTables.push(table)
      }

      if (writtenTables.length === 0) {
        await appendAudit(opts.bitable, operator, "failed", targetLabel, at)
        return { status: "failed", failedTables }
      }

      if (failedTables.length > 0) {
        await appendAudit(opts.bitable, operator, "partial", targetLabel, at)
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

      await appendAudit(opts.bitable, operator, "ok", targetLabel, at)
      return { status: "ok", version, writtenTables, at }
    },
  }
}
