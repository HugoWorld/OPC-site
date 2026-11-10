/* ------------------------------------------------------------------ */
/* 飞书多维表格适配层（v1.1 契约冻结，**尚未接入**）                     */
/*                                                                     */
/* 对应 PRD v1.1：§3.3.9 FR-BE（数据后端）、附录 A.7（12 张表结构）。    */
/*                                                                     */
/* 现状：本文件只声明契约与表清单，所有读写函数返回「未接入」，            */
/*       调用方必须回落到本地 localStorage（草稿 / 已发布）。            */
/*                                                                     */
/* 接入时只改本文件：                                                   */
/*   1. 填 `BITABLE_ENV.appToken` / `gateway` / `callbackUrl`（O-8、O-9）；*/
/*   2. 把 `pullAll` / `pushAll` 的 fetch 指向受控网关；                  */
/*   3. `app_secret` 一律不进前端——换 token 由网关完成。                  */
/* ------------------------------------------------------------------ */

import { FEISHU_TABLE_IDS, TABLE_SPECS } from "./data/table-specs.ts"
import type { TableSpec } from "./data/table-schema.ts"

/** 接入状态：未接入 / 已接入 / 降级（部分表读失败） */
export type BitableStatus = "not_connected" | "connected" | "degraded"

/** 一张表 ↔ 一个（或一组）数据切片的映射 */
export interface BitableTableSpec {
  /** 多维表格里的表名（建表时照此命名） */
  table: string
  /** 业务主键列：行与行靠它区分 */
  primaryKey: string
  /** 对应的 EditableData 切片键 */
  slices: string[]
  /** 中文说明，用于工作台提示 */
  label: string
}

/**
 * 12 张表（与 PRD 附录 A.7 逐行对应；字段名用代码侧小驼峰，不用中文列名）。
 * 改这里必须同步改 PRD A.7，否则 TC-27 不通过。
 */
export const BITABLE_TABLES: BitableTableSpec[] = [
  { table: "site_config", primaryKey: "brandName", slices: ["site", "nav", "cta", "footerColumns", "footerBoundary", "footerAigc", "pageSettings", "contact"], label: "站点配置（单行；无 site_nav 子表）" },
  { table: "home_blocks", primaryKey: "id", slices: ["hero", "stats", "valueProps", "audiences", "homeSections", "demos", "demoVideos", "productCarousel"], label: "首页区块（8 行）" },
  { table: "solutions", primaryKey: "id", slices: ["solutions"], label: "方案" },
  { table: "articles", primaryKey: "slug", slices: ["articles"], label: "文章" },
  { table: "products", primaryKey: "id", slices: ["products"], label: "产品卡" },
  { table: "shares", primaryKey: "id", slices: ["shares"], label: "分享" },
  { table: "pages", primaryKey: "slug", slices: ["pages"], label: "自定义页面" },
  { table: "method_faq", primaryKey: "id", slices: ["method", "faqGroups"], label: "方法 / 价格 / FAQ（单行 id=method）" },
  { table: "about", primaryKey: "id", slices: ["about"], label: "关于我（单行 id=about）" },
  { table: "theme", primaryKey: "id", slices: ["theme"], label: "主题取值（单行 id=theme）" },
  { table: "samples_testimonials", primaryKey: "id", slices: ["samples", "testimonials"], label: "样例与证言" },
  { table: "audit_log", primaryKey: "seq", slices: [], label: "审计（登录 / 发布）" },
]

/** 取某张表的字段契约；未登记返回 null，调用方必须报错而不是猜字段。 */
export function tableSpecFor(table: string): TableSpec | null {
  return TABLE_SPECS[table] ?? null
}

/** 取某张表的实测 table_id；未登记返回 null。 */
export function tableIdFor(table: string): string | null {
  return FEISHU_TABLE_IDS[table] ?? null
}

/** 接入所需的运行时配置；空字符串 = 未配置（对应 PRD §6 O-8 / O-9） */
export const BITABLE_ENV: {
  appToken: string
  gateway: string
  callbackUrl: string
} = {
  appToken: "",
  gateway: "",
  callbackUrl: "",
}

/** 三项配置齐全才认为可接入 */
export function bitableReady(): boolean {
  return Boolean(BITABLE_ENV.appToken && BITABLE_ENV.gateway && BITABLE_ENV.callbackUrl)
}

export function bitableStatus(): BitableStatus {
  return bitableReady() ? "connected" : "not_connected"
}

/** 该切片由哪张表承载（用于发布前提示与错误定位） */
export function tableForSlice(slice: string): string | null {
  const hit = BITABLE_TABLES.find((t) => t.slices.includes(slice))
  return hit ? hit.table : null
}

/** 未接入时的统一返回，调用方据此回落本地 */
export interface BitableResult<T> {
  ok: boolean
  data?: T
  reason?: string
}

export async function pullAll<T>(): Promise<BitableResult<T>> {
  if (!bitableReady()) {
    return { ok: false, reason: "多维表格未接入：缺少 app_token / 网关 / 回调域名（见 PRD §6 O-8）" }
  }
  // 接入点：GET `${BITABLE_ENV.gateway}/bitable/pull?app_token=...`，按表逐个拉取
  return { ok: false, reason: "接入实现未完成" }
}

export async function pushAll<T>(payload: T): Promise<BitableResult<T>> {
  if (!bitableReady()) {
    return { ok: false, reason: "多维表格未接入：发布仍写本机已发布键，不构成成功落库" }
  }
  // 接入点：POST `${BITABLE_ENV.gateway}/bitable/push`，按主键 upsert 后回写快照
  void payload
  return { ok: false, reason: "接入实现未完成" }
}
