/* ------------------------------------------------------------------ */
/* 多维表格字段契约：字段类型、编解码与校验。                             */
/* 对应 PRD 附录 A.7，字段名与多维表格列名一致（小驼峰）。               */
/* 本模块为纯函数，不依赖 React 与浏览器，可在 Node 下直接单测。          */
/* ------------------------------------------------------------------ */

import type { Solution } from "../../data/solutions"

export type FieldKind =
  | "text"
  | "longtext"
  | "multiline"
  | "bool"
  | "number"
  | "date"
  | "url"
  | "json"

export interface FieldSpec {
  name: string
  kind: FieldKind
  required?: boolean
}

export interface TableSpec {
  table: string
  primaryKey: string
  fields: FieldSpec[]
}

export type TableRecord = Record<string, unknown>

export interface SchemaIssue {
  table: string
  primaryKey: string
  field: string
  code: string
  message: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

/* ---------------- 单元格编解码 ---------------- */

export function encodeCell(kind: FieldKind, value: unknown): string | number | boolean {
  switch (kind) {
    case "multiline":
      return Array.isArray(value)
        ? value.map((v) => String(v).trim()).filter(Boolean).join("\n")
        : ""
    case "bool":
      return value === true
    case "number": {
      const n = typeof value === "number" ? value : Number(value)
      return Number.isFinite(n) ? n : 0
    }
    case "json":
      return JSON.stringify(value ?? null)
    case "text":
    case "longtext":
    case "date":
    case "url":
      return value === null || value === undefined ? "" : String(value)
  }
}

export function decodeCell(kind: FieldKind, cell: unknown): unknown {
  switch (kind) {
    case "multiline": {
      if (Array.isArray(cell)) {
        return cell.map((v) => String(v).trim()).filter(Boolean)
      }
      return String(cell ?? "")
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean)
    }
    case "bool":
      return cell === true
    case "number": {
      const n = Number(cell)
      return Number.isFinite(n) ? n : 0
    }
    case "json": {
      if (cell === null || cell === undefined || cell === "") return null
      try {
        return JSON.parse(String(cell))
      } catch {
        return null
      }
    }
    case "text":
    case "longtext":
    case "date":
    case "url":
      return String(cell ?? "")
  }
}

/* ---------------- 记录级编码 ---------------- */

/** 按表契约把一个 JS 对象逐字段编码为可写入表格的记录。 */
export function encodeRecord(spec: TableSpec, source: TableRecord): TableRecord {
  const out: TableRecord = {}
  for (const f of spec.fields) {
    out[f.name] = encodeCell(f.kind, source[f.name])
  }
  return out
}

/* ---------------- 校验 ---------------- */

/**
 * 发布前校验。任何不合格字段都返回 issue；调用方应在 issue 非空时整次拒绝发布。
 * 校验对象是「即将写入的记录」，因此 multiline 期望字符串、json 期望字符串。
 */
export function validateRecord(spec: TableSpec, record: TableRecord): SchemaIssue[] {
  const pk = String(record[spec.primaryKey] ?? "")
  const issues: SchemaIssue[] = []

  const push = (field: string, code: string, message: string) =>
    issues.push({ table: spec.table, primaryKey: pk, field, code, message })

  for (const f of spec.fields) {
    const v = record[f.name]

    if (f.required && (v === undefined || v === null || v === "")) {
      push(f.name, "SCHEMA_REQUIRED", "必填字段缺失")
      continue
    }
    if (v === undefined || v === null || v === "") continue

    switch (f.kind) {
      case "url":
        if (typeof v !== "string" || !v.startsWith("https://")) {
          push(f.name, "SCHEMA_URL_INSECURE", "链接必须以 https:// 开头")
        }
        break
      case "date":
        if (typeof v !== "string" || !DATE_RE.test(v) || !isValidDate(v)) {
          push(f.name, "SCHEMA_DATE", "日期必须为 YYYY-MM-DD 且真实存在")
        }
        break
      case "number":
        if (typeof v !== "number" || !Number.isFinite(v)) {
          push(f.name, "SCHEMA_NUMBER", "数字字段不是有效数值")
        }
        break
      case "bool":
        if (typeof v !== "boolean") {
          push(f.name, "SCHEMA_BOOL", "布尔字段只接受 true/false")
        }
        break
      case "json":
        if (typeof v !== "string") {
          push(f.name, "SCHEMA_JSON", "JSON 字段必须是字符串")
        } else {
          try {
            JSON.parse(v)
          } catch {
            push(f.name, "SCHEMA_JSON", "JSON 无法解析")
          }
        }
        break
      case "text":
      case "longtext":
      case "multiline":
        break
    }
  }
  return issues
}

/* ---------------- solutions 表契约（PRD A.7） ---------------- */

export const SOLUTIONS_TABLE: TableSpec = {
  table: "solutions",
  primaryKey: "id",
  fields: [
    { name: "id", kind: "text", required: true },
    { name: "tier", kind: "text", required: true },
    { name: "title", kind: "text", required: true },
    { name: "subtitle", kind: "text" },
    { name: "audience", kind: "text" },
    { name: "problem", kind: "longtext" },
    { name: "capabilities", kind: "multiline" },
    { name: "deliverables", kind: "multiline" },
    { name: "boundaries", kind: "multiline" },
    { name: "stack", kind: "multiline" },
    { name: "demoStatus", kind: "text" },
    { name: "demoDuration", kind: "text" },
    { name: "demoNote", kind: "longtext" },
    { name: "order", kind: "number" },
    { name: "published", kind: "bool" },
    { name: "body", kind: "json" },
  ],
}

/* ---------------- solutions 切片映射 ---------------- */

const TIERS: readonly Solution["tier"][] = ["主推", "扩展", "引流"]
const DEMO_STATUS: readonly Solution["demo"]["status"][] = ["可演示", "待建"]

function asTier(v: unknown): Solution["tier"] {
  const s = String(v ?? "")
  return (TIERS as readonly string[]).includes(s) ? (s as Solution["tier"]) : "引流"
}

function asDemoStatus(v: unknown): Solution["demo"]["status"] {
  const s = String(v ?? "")
  return (DEMO_STATUS as readonly string[]).includes(s)
    ? (s as Solution["demo"]["status"])
    : "待建"
}

/** 把代码侧 Solution[] 编码为表记录（多值转换行、body 转 JSON、demo 拆三列）。 */
export function encodeSolutions(list: readonly Solution[]): TableRecord[] {
  return list.map((s) => ({
    id: s.id,
    tier: s.tier,
    title: s.title,
    subtitle: s.subtitle,
    audience: s.audience,
    problem: s.problem,
    capabilities: encodeCell("multiline", s.capabilities),
    deliverables: encodeCell("multiline", s.deliverables),
    boundaries: encodeCell("multiline", s.boundaries),
    stack: encodeCell("multiline", s.stack),
    demoStatus: s.demo.status,
    demoDuration: s.demo.duration,
    demoNote: s.demo.note,
    order: s.order,
    published: s.published !== false,
    body: encodeCell("json", s.body),
  }))
}

export interface DecodedSolution {
  id: string
  tier: Solution["tier"]
  title: string
  subtitle: string
  audience: string
  problem: string
  capabilities: string[]
  deliverables: string[]
  boundaries: string[]
  stack: string[]
  demo: {
    status: Solution["demo"]["status"]
    duration: string
    note: string
  }
  order: number
  published: boolean
  body: Solution["body"]
}

/** 把表记录还原为代码侧结构（用于快照读取 / 拉取后重建）。非法枚举值安全回落。 */
export function decodeSolutions(records: readonly TableRecord[]): DecodedSolution[] {
  return records.map((r) => {
    const body = decodeCell("json", r.body) as Solution["body"] | null
    return {
      id: String(r.id ?? ""),
      tier: asTier(r.tier),
      title: String(r.title ?? ""),
      subtitle: String(r.subtitle ?? ""),
      audience: String(r.audience ?? ""),
      problem: String(r.problem ?? ""),
      capabilities: decodeCell("multiline", r.capabilities) as string[],
      deliverables: decodeCell("multiline", r.deliverables) as string[],
      boundaries: decodeCell("multiline", r.boundaries) as string[],
      stack: decodeCell("multiline", r.stack) as string[],
      demo: {
        status: asDemoStatus(r.demoStatus),
        duration: String(r.demoDuration ?? ""),
        note: String(r.demoNote ?? ""),
      },
      order: decodeCell("number", r.order) as number,
      published: decodeCell("bool", r.published) as boolean,
      body: Array.isArray(body) ? body : [],
    }
  })
}
