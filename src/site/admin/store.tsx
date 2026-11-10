import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { apiUrl } from "@/site/admin/auth"
import type { PublishResult } from "@/site/admin/data/adapter"
import { readSnapshot } from "@/site/admin/data/snapshot"

import { AUDIENCES, DEMOS, DEMO_VIDEOS, HERO, HOME_SECTIONS, PRODUCT_CAROUSEL, STATS, TESTIMONIALS, VALUE_PROPS, type DemoVideo } from "@/site/data/home"
import { METHOD, FAQ_GROUPS } from "@/site/data/method"
import { SOLUTIONS, type Solution } from "@/site/data/solutions"
import { PRODUCTS, type Product } from "@/site/data/products"
import { SHARES, type Share } from "@/site/data/shares"
import { ABOUT } from "@/site/data/about"
import { CTA, FOOTER_AIGC, FOOTER_BOUNDARY, FOOTER_COLUMNS, NAV, PAGE_SETTINGS, SITE, type ContactContent } from "@/site/data/site"
import { ARTICLES, SAMPLES, type Article } from "@/site/data/writing"
import { DEFAULT_PAGES, type CustomPage } from "@/site/data/pages"

/* ------------------------------------------------------------------ */
/* 运营工作台数据层（草稿 / 已发布 双层）                                */
/* - 默认数据来自 data/*.ts；                                            */
/* - 工作台编辑写入「草稿」localStorage；                                */
/* - 点「发布」把草稿复制到「已发布」localStorage；                       */
/* - 站点前台读取「已发布」（无发布记录则用默认值）；                     */
/* - 预览面板（?preview=1）读取「草稿」实时效果。                        */
/* ------------------------------------------------------------------ */

export const DRAFT_KEY = "hugow-admin-draft-v1"
export const PUBLISHED_KEY = "hugow-admin-published-v1"
/** 兼容旧版单存储 key（一次性迁移） */
const LEGACY_KEY = "hugow-admin-v1"

/* ---------------- 主题配置 ---------------- */

export interface ThemeConfig {
  /** 强调色 hex（运行时覆盖 --primary / --ring / --brand-accent） */
  accent: string
  /** 渐变副色 hex（运行时覆盖 --brand-accent2，配合强调色构成标题/光斑渐变） */
  accent2: string
  /** 页面纵向密度：compact 紧凑 / normal 标准 / relaxed 宽松 */
  density: "compact" | "normal" | "relaxed"
  /** 品牌形象图 URL（空 = 用占位字「H」） */
  avatarUrl: string
  /** 品牌字（占位字，与 avatarUrl 互斥展示） */
  avatarLetter: string
  /**
   * 当前首页映射：指向页面注册表里的自定义页 slug（如 studio）。
   * 为空 = 使用内置首页；设置了且页面存在 = 前台 / 路由渲染该页面区块。
   * 由「页面管理」的「设为首页」写入，「主题与排版」可恢复内置首页。
   */
  homePageSlug?: string
}

export const ACCENT_PRESETS = [
  { name: "活力橙", hex: "#ff5d01" },
  { name: "珊瑚红", hex: "#f43f5e" },
  { name: "玫粉", hex: "#e11d48" },
  { name: "亮紫", hex: "#8b5cf6" },
  { name: "天蓝", hex: "#0284c7" },
  { name: "湖青", hex: "#0891b2" },
  { name: "松绿", hex: "#16a34a" },
  { name: "墨蓝", hex: "#1d4ed8" },
]

/** 渐变副色预设（与强调色两两组合出标题渐变） */
export const ACCENT2_PRESETS = [
  { name: "亮紫", hex: "#8b5cf6" },
  { name: "品红", hex: "#d946ef" },
  { name: "天蓝", hex: "#0284c7" },
  { name: "湖青", hex: "#06b6d4" },
  { name: "琥珀金", hex: "#d97706" },
  { name: "珊瑚", hex: "#f43f5e" },
  { name: "松绿", hex: "#16a34a" },
  { name: "墨蓝", hex: "#1d4ed8" },
]

export const DEFAULT_THEME: ThemeConfig = {
  accent: "#ff5d01",
  accent2: "#8b5cf6",
  density: "normal",
  avatarUrl: "",
  avatarLetter: "H",
}

/* ---------------- 可编辑切片 ---------------- */

export interface EditableData {
  site: typeof SITE
  nav: typeof NAV
  cta: typeof CTA
  footerColumns: typeof FOOTER_COLUMNS
  footerBoundary: string
  footerAigc: string
  hero: typeof HERO
  stats: typeof STATS
  valueProps: typeof VALUE_PROPS
  audiences: typeof AUDIENCES
  homeSections: typeof HOME_SECTIONS
  demos: typeof DEMOS
  demoVideos: DemoVideo[]
  /** 「我的产品」轮播设置（间隔毫秒；工作台可自定义） */
  productCarousel: typeof PRODUCT_CAROUSEL
  products: Product[]
  testimonials: typeof TESTIMONIALS
  shares: Share[]
  solutions: Solution[]
  articles: Article[]
  samples: typeof SAMPLES
  method: typeof METHOD
  faqGroups: typeof FAQ_GROUPS
  about: typeof ABOUT
  theme: ThemeConfig
  /** 二级页页面设置（标题 / 导语；工作台「站点信息」可改） */
  pageSettings: typeof PAGE_SETTINGS
  /** 联系 / 预约落地页内容（缺省回退 site.ts 默认文案；工作台可覆盖） */
  contact?: ContactContent
  /** 自定义页面注册表（通用化：动态二级页面） */
  pages: CustomPage[]
}

export type SliceKey = keyof EditableData

const DEFAULTS: Omit<EditableData, "theme"> = {
  site: SITE,
  nav: NAV,
  cta: CTA,
  footerColumns: FOOTER_COLUMNS,
  footerBoundary: FOOTER_BOUNDARY,
  footerAigc: FOOTER_AIGC,
  hero: HERO,
  stats: STATS,
  valueProps: VALUE_PROPS,
  audiences: AUDIENCES,
  homeSections: HOME_SECTIONS,
  demos: DEMOS,
  demoVideos: DEMO_VIDEOS,
  productCarousel: PRODUCT_CAROUSEL,
  products: PRODUCTS,
  testimonials: TESTIMONIALS,
  shares: SHARES,
  solutions: SOLUTIONS,
  articles: ARTICLES,
  samples: SAMPLES,
  method: METHOD,
  faqGroups: FAQ_GROUPS,
  about: ABOUT,
  pageSettings: PAGE_SETTINGS,
  pages: DEFAULT_PAGES,
}

function load(key: string): Partial<EditableData> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 隐私模式等场景下静默降级为仅内存生效 */
  }
}

/** 一次性迁移旧版单存储 → 已发布层（仅当新 key 不存在时）。 */
function migrateLegacy() {
  try {
    if (!localStorage.getItem(PUBLISHED_KEY)) {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        localStorage.setItem(PUBLISHED_KEY, legacy)
        localStorage.removeItem(LEGACY_KEY)
      }
    }
  } catch {
    /* 忽略迁移失败 */
  }
}

/* ---------------- 工具函数 ---------------- */

export function sortSolutions(list: Solution[]) {
  return [...list].sort((a, b) => a.order - b.order)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** 局部对象深合并：数组与标量整体替换，嵌套对象逐键合并。
 *  目的：已存在 localStorage 里的旧切片（缺新增字段）能与新默认值兼容。 */
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : (override as T))
  }
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(override)) {
    const b = (base as Record<string, unknown>)[k]
    out[k] = isPlainObject(v) && isPlainObject(b) ? deepMerge(b, v) : v
  }
  return out as T
}

/** 合并「默认 + 覆盖」得到完整数据。 */
function mergeData(overrides: Partial<EditableData>): EditableData {
  const merged = { ...(DEFAULTS as EditableData) } as EditableData
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) continue
    const key = k as keyof EditableData
    ;(merged as unknown as Record<string, unknown>)[key] = deepMerge(
      (DEFAULTS as unknown as Record<string, unknown>)[key],
      v,
    )
  }
  merged.theme = { ...DEFAULT_THEME, ...(overrides.theme ?? {}) }
  return merged
}

/* ---------------- Context ---------------- */

export interface SiteStore {
  /** 当前作用域数据：published（站点前台）或 draft（工作台 / 预览） */
  data: EditableData
  /** 草稿覆盖字典（工作台编辑的对象） */
  draft: Partial<EditableData>
  /** 已发布覆盖字典 */
  published: Partial<EditableData>
  /** 当前作用域是草稿还是已发布 */
  scope: "draft" | "published"
  /** 更新一个切片（写入草稿层，自动保存） */
  setSlice: <K extends SliceKey>(key: K, value: EditableData[K]) => void
  /** 批量更新多个切片（一次写入草稿层；避免连续 setSlice 因 state 快照互相覆盖） */
  setSlices: (patches: Partial<EditableData>) => void
  /** 重置某切片到默认值（写草稿层，传 undefined 重置全部草稿） */
  resetSlice: (key?: SliceKey) => void
  /** 发布全部：草稿 → 网关 12 表 + 本机快照（异步，失败不切换线上） */
  publishAll: () => Promise<void>
  /** 发布单个切片：合并「已发布 + 该切片草稿」后整体发布 */
  publishSlice: (key: SliceKey) => Promise<void>
  /** 正在发布（按钮禁用 / 文案反馈） */
  publishing: boolean
  /** 最近一次发布的失败原因（成功时清空） */
  publishError: string | null
  /** 重置已发布层 */
  resetPublished: () => void
  /** 是否有未发布的草稿改动 */
  hasDraftChanges: boolean
  /** 某切片是否有草稿改动（相对已发布） */
  sliceHasDraftChange: (key: SliceKey) => boolean
  /** 草稿最后保存时间戳 */
  lastDraftSavedAt: number | null
  /** 上次发布成功时间戳 */
  lastPublishedAt: number | null
}

const SiteStoreContext = createContext<SiteStore | null>(null)

export function SiteStoreProvider({
  children,
  scope = "published",
}: {
  children: ReactNode
  /** draft：工作台与预览用（编辑中效果）；published：站点前台用（已发布效果） */
  scope?: "draft" | "published"
}) {
  migrateLegacy()
  const [published, setPublished] = useState<Partial<EditableData>>(() => load(PUBLISHED_KEY))
  const [draft, setDraft] = useState<Partial<EditableData>>(() => load(DRAFT_KEY))
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null)
  const [lastPublishedAt, setLastPublishedAt] = useState<number | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const active = scope === "draft" ? draft : published
  const data = useMemo(() => mergeData(active), [active])

  // 跨文档草稿同步：预览 iframe 与工作台同源，工作台写入 DRAFT_KEY 后，
  // iframe 会收到 storage 事件，重新加载草稿实现「输入即预览」。
  useEffect(() => {
    if (scope !== "draft") return
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFT_KEY) {
        setDraft(load(DRAFT_KEY))
        setLastDraftSavedAt(Date.now())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [scope])

  // 访客站以发布快照为准：读取 ./data/current.json → 版本文件；失败回落本地缓存。
  // 快照由 Nginx 静态托管（www 与 admin 共用同一数据目录），不依赖管理台 Cookie。
  useEffect(() => {
    if (scope !== "published") return
    const ctrl = new AbortController()
    void (async () => {
      const envelope = await readSnapshot({
        fetchImpl: (input, init) =>
          fetch(input, { ...init, signal: ctrl.signal }),
      })
      if (ctrl.signal.aborted || !envelope) return
      setPublished(envelope.data)
      persist(PUBLISHED_KEY, envelope.data)
      if (typeof envelope.generatedAt === "number") setLastPublishedAt(envelope.generatedAt)
    })()
    return () => ctrl.abort()
  }, [scope])

  // 主题应用：覆盖 CSS 变量（工作台自身也跟随草稿主题，预览与前台跟随各自作用域）
  // 主题色写 :root（前台 .site-dark 继承，保证主题令牌真正驱动前台视觉）
  useEffect(() => {
    const theme = data.theme
    const root = document.documentElement
    root.style.setProperty("--primary", theme.accent)
    root.style.setProperty("--ring", theme.accent)
    root.style.setProperty("--brand-accent", theme.accent)
    root.style.setProperty("--brand-accent2", theme.accent2)
    root.style.setProperty("--accent", `color-mix(in oklab, ${theme.accent} 10%, transparent)`)
    root.style.setProperty("--accent-foreground", `color-mix(in oklab, ${theme.accent} 55%, #181b26)`)
    root.dataset.density = theme.density
  }, [data.theme])

  const hasDraftChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(published),
    [draft, published]
  )

  const sliceHasDraftChange = (key: SliceKey) =>
    JSON.stringify(draft[key]) !== JSON.stringify(published[key])

  const store = useMemo<SiteStore>(() => {
    const persistDraft = (next: Partial<EditableData>) => {
      setDraft(next)
      setLastDraftSavedAt(Date.now())
      persist(DRAFT_KEY, next)
    }

    const postPublish = async (nextDraft: Partial<EditableData>, success: () => void) => {
      setPublishing(true)
      setPublishError(null)
      try {
        const res = await fetch(apiUrl("/api/publish"), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ draft: nextDraft }),
        })
        const result = (await res.json().catch(() => null)) as
          | PublishResult
          | { error?: { code?: string; message?: string } }
          | null

        if (res.status === 401) {
          setPublishError("登录已过期，请重新登录后再发布。")
          return
        }
        if (res.status === 429) {
          setPublishError("发布过于频繁（每账号 3 次/分钟），请稍后再试。")
          return
        }
        if (res.ok) {
          success()
          setLastPublishedAt(Date.now())
          return
        }
        if (res.status === 207 && result && "failedTables" in result) {
          const failed = result.failedTables ?? []
          setPublishError(
            `部分表写入失败，线上快照未切换：${failed
              .map((f) => `${f.table}（${f.code}）`)
              .join("、")}`,
          )
          return
        }
        const message =
          result && "error" in result && result.error?.message
            ? result.error.message
            : `发布失败（HTTP ${res.status}）`
        setPublishError(message)
      } catch {
        setPublishError("网关不可达或网络中断，发布未完成。")
      } finally {
        setPublishing(false)
      }
    }

    return {
      data,
      draft,
      published,
      scope,
      setSlice: (key, value) => persistDraft({ ...draft, [key]: value }),
      setSlices: (patches) => persistDraft({ ...draft, ...patches }),
      resetSlice: (key) => {
        if (!key) return persistDraft({})
        const next = { ...draft }
        delete next[key]
        persistDraft(next)
      },
      publishAll: () => postPublish(draft, () => {
        persist(PUBLISHED_KEY, draft)
        setPublished({ ...draft })
      }),
      publishSlice: (key) => {
        const next: Record<string, unknown> = { ...published }
        const draftVal = draft[key]
        if (draftVal === undefined) {
          delete next[key]
        } else {
          next[key] = draftVal
        }
        return postPublish(next as Partial<EditableData>, () => {
          persist(PUBLISHED_KEY, next)
          setPublished(next as Partial<EditableData>)
        })
      },
      resetPublished: () => {
        localStorage.removeItem(PUBLISHED_KEY)
        setPublished({})
      },
      publishing,
      publishError,
      hasDraftChanges,
      sliceHasDraftChange,
      lastDraftSavedAt,
      lastPublishedAt,
    }
  }, [data, draft, published, scope, publishing, publishError, hasDraftChanges, lastDraftSavedAt, lastPublishedAt])

  return <SiteStoreContext.Provider value={store}>{children}</SiteStoreContext.Provider>
}

export function useSiteStore(): SiteStore {
  const ctx = useContext(SiteStoreContext)
  if (!ctx) throw new Error("useSiteStore must be used within SiteStoreProvider")
  return ctx
}

/** 站点页面统一入口：读取当前作用域合并后的数据。 */
export function useSiteData() {
  return useSiteStore().data
}
