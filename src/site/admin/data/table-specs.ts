/* ------------------------------------------------------------------ */
/* 12 张飞书多维表格的字段契约（按 2026-11-10 实测结构生成）              */
/*                                                                     */
/* 来源：docs/delivery/feishu-12表字段映射.csv（114 字段）              */
/* 说明：feishu_type 是飞书列的真实类型；kind 是代码侧编解码类型。        */
/*      text 列可承载 json / multiline 的字符串形态，属于「可写入但形态  */
/*      退化」；必须通过 encodeCell() 显式编码，不能直接塞对象。          */
/* ------------------------------------------------------------------ */

import type { TableSpec } from "./table-schema.ts"
import { SOLUTIONS_TABLE } from "./table-schema.ts"

/** 表名 → 实测 table_id；适配层只认这套坐标，避免运行期猜表。 */
export const FEISHU_TABLE_IDS: Record<string, string> = {
  site_config: "tblmk0h49rjsRu09",
  home_blocks: "tblUJEXb3NKPl8P0",
  solutions: "tblkYSF2mEGSIqiO",
  articles: "tblg3kW0m8Rxq7IF",
  products: "tblnIFxJ3fXalWpg",
  shares: "tblTMRCdcrM3VxMU",
  pages: "tblDUFpEdPmsZoWZ",
  method_faq: "tblwqrEvsJn3UlXd",
  about: "tbluHzMJbE3MdtAg",
  theme: "tbl1MYrfFpvFf4d8",
  samples_testimonials: "tblgX27LxBmepNpx",
  audit_log: "tblOaWUnCJKo7tJy",
}

export const SITE_CONFIG_TABLE: TableSpec = {
  table: "site_config",
  primaryKey: "brandName",
  fields: [
    { name: "brandName", kind: "text", required: true },
    { name: "brandShort", kind: "text" },
    { name: "tagline", kind: "text" },
    { name: "locale", kind: "text" },
    { name: "author", kind: "text" },
    { name: "company", kind: "text" },
    { name: "icoNote", kind: "text" },
    { name: "mascotAlt", kind: "text" },
    { name: "email", kind: "text" },
    { name: "emailHref", kind: "text" },
    { name: "wechatNote", kind: "text" },
    { name: "responseTime", kind: "text" },
    { name: "demoDuration", kind: "text" },
    { name: "nav", kind: "json" },
    { name: "cta", kind: "json" },
    { name: "footerColumns", kind: "json" },
    { name: "footerBoundary", kind: "text" },
    { name: "footerAigc", kind: "text" },
    { name: "pageSettings", kind: "json" },
    { name: "contact", kind: "json" },
  ],
}

export const HOME_BLOCKS_TABLE: TableSpec = {
  table: "home_blocks",
  primaryKey: "id",
  fields: [
    { name: "id", kind: "text", required: true },
    { name: "type", kind: "text", required: true },
    { name: "title", kind: "text" },
    { name: "eyebrow", kind: "text" },
    { name: "lead", kind: "text" },
    { name: "note", kind: "text" },
    { name: "items", kind: "json" },
    { name: "order", kind: "number" },
  ],
}

export const ARTICLES_TABLE: TableSpec = {
  table: "articles",
  primaryKey: "slug",
  fields: [
    { name: "slug", kind: "text", required: true },
    { name: "title", kind: "text", required: true },
    { name: "category", kind: "text" },
    { name: "date", kind: "text" },
    { name: "summary", kind: "text" },
    { name: "takeaway", kind: "text" },
    { name: "tags", kind: "json" },
    { name: "modules", kind: "json" },
    { name: "status", kind: "text" },
    { name: "body", kind: "json" },
    { name: "readMinutes", kind: "number" },
  ],
}

export const PRODUCTS_TABLE: TableSpec = {
  table: "products",
  primaryKey: "id",
  fields: [
    { name: "id", kind: "text", required: true },
    { name: "name", kind: "text", required: true },
    { name: "intro", kind: "longtext" },
    { name: "category", kind: "text" },
    { name: "tags", kind: "json" },
    { name: "coverUrl", kind: "text" },
    { name: "link", kind: "text" },
    { name: "order", kind: "number" },
    { name: "published", kind: "bool" },
  ],
}

export const SHARES_TABLE: TableSpec = {
  table: "shares",
  primaryKey: "id",
  fields: [
    { name: "id", kind: "text", required: true },
    { name: "title", kind: "text", required: true },
    { name: "desc", kind: "text" },
    { name: "url", kind: "text" },
    { name: "group", kind: "text" },
    { name: "kind", kind: "text" },
    { name: "author", kind: "text" },
    { name: "order", kind: "number" },
    { name: "published", kind: "bool" },
  ],
}

export const PAGES_TABLE: TableSpec = {
  table: "pages",
  primaryKey: "slug",
  fields: [
    { name: "slug", kind: "text", required: true },
    { name: "title", kind: "text", required: true },
    { name: "inNav", kind: "bool" },
    { name: "origin", kind: "text" },
    { name: "blocksJson", kind: "json" },
  ],
}

export const METHOD_FAQ_TABLE: TableSpec = {
  table: "method_faq",
  primaryKey: "id",
  fields: [
    { name: "id", kind: "text", required: true },
    { name: "steps", kind: "json" },
    { name: "pricing", kind: "json" },
    { name: "noPromise", kind: "json" },
    { name: "boundaries", kind: "json" },
    { name: "faq", kind: "json" },
  ],
}

export const ABOUT_TABLE: TableSpec = {
  table: "about",
  primaryKey: "id",
  fields: [
    { name: "id", kind: "text", required: true },
    { name: "lead", kind: "text" },
    { name: "intro", kind: "text" },
    { name: "timeline", kind: "json" },
    { name: "principles", kind: "json" },
    { name: "boundaries", kind: "json" },
  ],
}

export const THEME_TABLE: TableSpec = {
  table: "theme",
  primaryKey: "id",
  fields: [
    { name: "id", kind: "text", required: true },
    { name: "accent", kind: "text" },
    { name: "accent2", kind: "text" },
    { name: "density", kind: "text" },
    { name: "avatarUrl", kind: "text" },
    { name: "letter", kind: "text" },
    { name: "homePageSlug", kind: "text" },
  ],
}

export const SAMPLES_TESTIMONIALS_TABLE: TableSpec = {
  table: "samples_testimonials",
  primaryKey: "id",
  fields: [
    { name: "id", kind: "text", required: true },
    { name: "kind", kind: "text", required: true },
    { name: "title", kind: "text" },
    { name: "desc", kind: "text" },
    { name: "quote", kind: "text" },
    { name: "name", kind: "text" },
    { name: "role", kind: "text" },
    { name: "project", kind: "text" },
    { name: "order", kind: "number" },
    { name: "published", kind: "bool" },
  ],
}

export const AUDIT_LOG_TABLE: TableSpec = {
  table: "audit_log",
  primaryKey: "seq",
  fields: [
    { name: "seq", kind: "number", required: true },
    { name: "openId", kind: "text" },
    { name: "at", kind: "text" },
    { name: "result", kind: "text" },
    { name: "target", kind: "text" },
    { name: "action", kind: "text" },
  ],
}

/** 12 张表的完整契约；`solutions` 复用既有 16 字段契约 + proof。 */
export const TABLE_SPECS: Record<string, TableSpec> = {
  site_config: SITE_CONFIG_TABLE,
  home_blocks: HOME_BLOCKS_TABLE,
  solutions: {
    ...SOLUTIONS_TABLE,
    fields: [...SOLUTIONS_TABLE.fields, { name: "proof", kind: "json" }],
  },
  articles: ARTICLES_TABLE,
  products: PRODUCTS_TABLE,
  shares: SHARES_TABLE,
  pages: PAGES_TABLE,
  method_faq: METHOD_FAQ_TABLE,
  about: ABOUT_TABLE,
  theme: THEME_TABLE,
  samples_testimonials: SAMPLES_TESTIMONIALS_TABLE,
  audit_log: AUDIT_LOG_TABLE,
}

export const TABLE_SPEC_LIST: TableSpec[] = Object.values(TABLE_SPECS)
