/* ------------------------------------------------------------------ */
/* v1.0 本地数据 → 云端的一次性迁移包。                                 */
/* 纯逻辑模块：构建、解析与结构校验；UI 与网关据此导入导出。             */
/* ------------------------------------------------------------------ */

import type { EditableData } from "../store"

export const MIGRATION_SCHEMA_VERSION = 1

export interface MigrationPackage {
  exportedAt: number
  schemaVersion: number
  draft: Partial<EditableData>
  published: Partial<EditableData>
}

export type ParseMigrationResult =
  | { ok: true; pkg: MigrationPackage }
  | { ok: false; error: string }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** 构建迁移包：草稿与已发布两个覆盖字典一并打包。 */
export function buildMigrationPackage(
  draft: Partial<EditableData>,
  published: Partial<EditableData>,
  now: number = Date.now(),
): MigrationPackage {
  return {
    exportedAt: now,
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    draft,
    published,
  }
}

/** 解析迁移包；结构不合法或版本不符时返回错误，调用方不得继续导入。 */
export function parseMigrationPackage(raw: string): ParseMigrationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: "迁移包不是合法 JSON" }
  }

  if (!isObject(parsed)) {
    return { ok: false, error: "迁移包结构不正确" }
  }
  if (parsed.schemaVersion !== MIGRATION_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `不支持的迁移版本：${String(parsed.schemaVersion)}`,
    }
  }
  if (!isObject(parsed.draft) || !isObject(parsed.published)) {
    return { ok: false, error: "迁移包缺少 draft 或 published" }
  }
  if (typeof parsed.exportedAt !== "number") {
    return { ok: false, error: "迁移包缺少导出时间" }
  }

  return { ok: true, pkg: parsed as unknown as MigrationPackage }
}
