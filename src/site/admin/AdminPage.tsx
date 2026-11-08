import { useCallback, useEffect, useRef, useState } from "react"
import {
  Box,
  Check,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FileJson,
  Files,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  LogOut,
  Maximize2,
  Megaphone,
  Minimize2,
  RefreshCcw,
  Rocket,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  Type,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AdminLoginGate, loadSession, shortOpenId, signOut } from "@/site/admin/auth"
import { BITABLE_TABLES, bitableReady } from "@/site/admin/bitable"
import {
  ACCENT2_PRESETS,
  ACCENT_PRESETS,
  DRAFT_KEY,
  PUBLISHED_KEY,
  useSiteStore,
  type EditableData,
  type SliceKey,
} from "@/site/admin/store"
import { GroupedEditor } from "@/site/admin/forms"
import { PageManager } from "@/site/admin/PageManager"
import { OnboardingProvider } from "@/site/admin/onboarding/OnboardingProvider"
import { OnboardingChip, OnboardingWizard } from "@/site/admin/onboarding/OnboardingWizard"
import { SetupChecklist } from "@/site/admin/onboarding/SetupChecklist"
import { THEME_PACKS, PACK_DEMOS, type ThemePack } from "@/site/data/themes"

/* ------------------------------------------------------------------ */
/* 运营工作台：侧栏导航 + 分组可折叠编辑器 + 右侧实时预览 + 发布流程。  */
/* - 编辑写「草稿」localStorage（自动保存）；                           */
/* - 右侧 iframe 预览站点草稿效果，编辑某组时动态定位 + 高亮；          */
/* - 点「发布」把草稿复制到「已发布」，站点前台才生效。                  */
/* ------------------------------------------------------------------ */

type TabKey =
  | "overview"
  | "site"
  | "home"
  | "products"
  | "shares"
  | "solutions"
  | "writing"
  | "method"
  | "about"
  | "pages"
  | "theme"
  | "publish"

const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { key: "overview", label: "总览", icon: LayoutDashboard, hint: "建站与站点状态" },
  { key: "site", label: "站点信息", icon: Type, hint: "品牌 / 导航 / CTA / 页脚" },
  { key: "home", label: "首页内容", icon: Sparkles, hint: "人设 / 数字条 / 模块卡 / 演示卡" },
  { key: "products", label: "产品管理", icon: Box, hint: "产品卡片 / 演示视频" },
  { key: "shares", label: "分享管理", icon: Share2, hint: "GitHub 项目 / 博主文章 / 好工具" },
  { key: "solutions", label: "能力模块", icon: Rocket, hint: "能做什么列表与详情" },
  { key: "writing", label: "文章与案例", icon: FileCode2, hint: "文章 / 样例 / 分类标签" },
  { key: "method", label: "方法与 FAQ", icon: ShieldCheck, hint: "交付流程 / 价格 / FAQ" },
  { key: "about", label: "关于我", icon: Megaphone, hint: "履历 / 原则 / 边界" },
  { key: "pages", label: "页面管理", icon: Files, hint: "自定义页面 · 区块编排 · 模板/导入" },
  { key: "theme", label: "主题与排版", icon: Type, hint: "主题库一键应用 / 配色密度微调" },
  { key: "publish", label: "发布与导出", icon: FileJson, hint: "发布草稿 / 导出 YAML / TS" },
]

/** 发布前的二次确认文案：发布是不可逆的前台变更，必须让操作者再确认一次。 */
const PUBLISH_CONFIRM_TEXT =
  "发布后会立即更新站点前台（游客可见），并覆盖上一次已发布的内容。\n确认现在发布？"

/* ---------------- 预览定位映射 ----------------
 * 每个切片对应站点某个页面区块：
 * - path: 预览 iframe 的 hash 路由
 * - anchor: 该页面内 data-preview-anchor 锚点
 */
const PREVIEW_TARGET: Record<SliceKey, { path: string; anchor?: string; groupAnchors?: Record<string, string> }> = {
  site: { path: "/", anchor: "hero" },
  nav: { path: "/", anchor: "hero" },
  cta: { path: "/", anchor: "cta" },
  footerColumns: { path: "/", anchor: "about" },
  footerBoundary: { path: "/", anchor: "about" },
  footerAigc: { path: "/", anchor: "about" },
  hero: { path: "/", anchor: "hero" },
  stats: { path: "/", anchor: "stats" },
  valueProps: { path: "/", anchor: "valueProps" },
  audiences: { path: "/", anchor: "demos" },
  homeSections: { path: "/", anchor: "hero" },
  demos: { path: "/", anchor: "demos" },
  demoVideos: { path: "/", anchor: "demos" },
  testimonials: { path: "/", anchor: "evidence" },
  productCarousel: { path: "/", anchor: "products" },
  products: { path: "/", anchor: "products" },
  shares: { path: "/", anchor: "shares" },
  solutions: { path: "/solutions/", anchor: "solutions" },
  articles: { path: "/writing/", anchor: "articles" },
  samples: { path: "/cases/", anchor: "samples" },
  method: {
    path: "/method/",
    groupAnchors: { process: "method-process", tiers: "method-tiers", notpromise: "method-boundaries", boundaries: "method-boundaries" },
  },
  faqGroups: { path: "/method/", anchor: "faqGroups" },
  about: { path: "/about/", anchor: "about" },
  pageSettings: { path: "/solutions/", anchor: "solutions" },
  theme: { path: "/", anchor: "hero" },
  contact: { path: "/contact/", anchor: "contact" },
  pages: { path: "/pages/services/", anchor: "p-services-hero" },
}

/** 切片内对象分组的锚点（method 等需要更精细定位） */
const GROUP_ANCHORS: Record<string, Record<string, string>> = {
  method: {
    process: "method-process",
    tiers: "method-tiers",
    notpromise: "method-boundaries",
    boundaries: "method-boundaries",
  },
  about: {
    intro: "about",
    timeline: "about",
    beliefs: "about",
    boundaries: "about",
  },
}

/* ---------------- 右侧预览 iframe ---------------- */

export interface PreviewTarget {
  path: string
  anchor?: string
  groupAnchor?: string
}

function PreviewPane({ target }: { target: PreviewTarget }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const lastLocate = useRef("")
  const lastSrc = useRef("")

  // target 变化（切换 tab / 展开某组）→ 导航 iframe 并定位高亮
  const locate = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return
    const anchor = target.groupAnchor ?? target.anchor
    const key = `${target.path}#${anchor ?? ""}`
    const src = `${window.location.origin}${window.location.pathname}${window.location.search}#${target.path}?preview=1`
    if (src !== lastSrc.current) {
      // 路由不同：导航，onLoad 后再定位
      lastSrc.current = src
      lastLocate.current = key
      iframe.src = src
      return
    }
    lastLocate.current = key
    // 同路由：直接定位（iframe 已在该页）
    iframe.contentWindow.postMessage({ type: "locate", anchor, durationMs: 2200 }, "*")
  }, [target])

  useEffect(() => {
    locate()
  }, [locate])

  // 路由加载完成后下发定位
  const onLoad = () => {
    setLoaded(true)
    const anchor = target.groupAnchor ?? target.anchor
    lastLocate.current = `${target.path}#${anchor ?? ""}`
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "locate", anchor, durationMs: 2200 }, "*")
    }
  }

  // 全屏平铺预览：Esc / 按钮均可缩回
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen])

  const flatHref = `${window.location.origin}${window.location.pathname}${window.location.search}#${target.path}`

  return (
    <>
    <aside className="hidden w-[420px] shrink-0 flex-col lg:flex" aria-label="站点实时预览">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-primary/10">
            <ExternalLink className="size-3.5 text-primary" />
          </span>
          <div>
            <div className="text-[12.5px] font-semibold">站点实时预览</div>
            <div className="text-[11px] text-muted-foreground">
              窄栏预览近似移动端 · 桌面效果点「平铺预览」
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/15"
            title="在工作台内按正常桌面宽度全屏预览，再点或按 Esc 缩回"
          >
            <Maximize2 className="size-3" />
            平铺预览
          </button>
          <a
            href={flatHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            title="在新标签页打开当前预览页"
          >
            <ExternalLink className="size-3" />
            新标签
          </a>
          <button
            type="button"
            onClick={locate}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            定位当前组
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-background">
        <iframe
          ref={iframeRef}
          src={`${window.location.origin}${window.location.pathname}${window.location.search}#${target.path}?preview=1`}
          onLoad={onLoad}
          title="站点实时预览"
          className="h-full w-full border-0 bg-white"
        />
        {!loaded && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background">
            <span className="text-[12.5px] text-muted-foreground">加载预览…</span>
          </div>
        )}
      </div>
    </aside>

    {/* 平铺全屏预览：正常桌面宽度，Esc / 按钮缩回 */}
    {fullscreen && (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10">
              <ExternalLink className="size-4 text-primary" />
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold">平铺全屏预览</div>
              <div className="truncate text-[11.5px] text-muted-foreground">
                正常桌面宽度渲染 · 点「缩回预览」或按 Esc 返回工作台
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={flatHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
              新标签打开
            </a>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-primary/15"
            >
              <Minimize2 className="size-3.5" />
              缩回预览
            </button>
          </div>
        </div>
        <iframe
          src={flatHref}
          title="平铺全屏预览"
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />
      </div>
    )}
  </>
  )
}

/* ---------------- 切片编辑器（分组可折叠 + 发布） ---------------- */

function SliceEditor<K extends SliceKey>({
  sliceKey,
  title,
  desc,
  onLocate,
}: {
  sliceKey: K
  title: string
  desc?: string
  onLocate?: (target: PreviewTarget) => void
}) {
  const { data, draft, setSlice, resetSlice, publishSlice, sliceHasDraftChange } = useSiteStore()
  const changed = sliceHasDraftChange(sliceKey)
  const value = data[sliceKey]

  // 空数组「添加一项」时的字段模板（保证新项有可编辑字段）
  const LIST_SEED: Partial<Record<SliceKey, Record<string, unknown>>> = {
    demoVideos: {
      id: "",
      productName: "",
      title: "",
      desc: "",
      coverUrl: "",
      videoUrl: "",
      durationText: "",
      order: 0,
      published: true,
    },
    products: {
      id: "",
      name: "",
      intro: "",
      tags: [],
      category: "",
      link: "",
      coverUrl: "",
      demoVideoId: "",
      order: 0,
      published: true,
    },
    shares: {
      id: "",
      kind: "github",
      topic: "",
      title: "",
      note: "",
      url: "",
      author: "",
      order: 0,
    },
  }

  // 组编辑回调：自动保存（setSlice 已写草稿）+ 通知上层定位预览
  const onEditGroup = useCallback(
    (groupKey: string) => {
      const base = PREVIEW_TARGET[sliceKey]
      const groupAnchor = GROUP_ANCHORS[sliceKey]?.[groupKey]
      onLocate?.({ path: base.path, anchor: base.anchor, groupAnchor })
    },
    [sliceKey, onLocate]
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold">{title}</h2>
            {desc && <p className="mt-1 max-w-[52ch] text-[12.5px] text-muted-foreground">{desc}</p>}
          </div>
          <div className="flex items-center gap-2">
            {changed && (
              <>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  草稿已保存 · 未发布
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (window.confirm(PUBLISH_CONFIRM_TEXT)) publishSlice(sliceKey)
                  }}
                >
                  <Check className="size-3.5" />
                  发布本模块
                </Button>
              </>
            )}
            {sliceKey in draft && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => resetSlice(sliceKey)}
              >
                <RefreshCcw className="size-3.5" />
                恢复默认
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <GroupedEditor
          label={title}
          value={value as Record<string, unknown>}
          onChange={(next) => setSlice(sliceKey, next as EditableData[K])}
          onEditGroup={onEditGroup}
          listSeed={LIST_SEED[sliceKey]}
        />
      </div>
    </div>
  )
}

/* ---------------- 总览 ---------------- */

function Overview({ onShowDataSource }: { onShowDataSource?: () => void }) {
  const { data, draft, hasDraftChanges, publishAll, lastPublishedAt, lastDraftSavedAt } = useSiteStore()

  const STAT_ICONS: Record<string, LucideIcon> = {
    solutions: Layers,
    articles: FileText,
    sections: LayoutGrid,
    pages: Files,
  }

  const stats: { label: string; value: string; note: string; icon: LucideIcon }[] = [
    {
      label: "能力模块",
      value: String(data.solutions.length),
      note: `${data.solutions.filter((s) => s.published !== false).length} 个上架`,
      icon: STAT_ICONS.solutions,
    },
    {
      label: "文章",
      value: String(data.articles.length),
      note: `${data.articles.filter((a) => a.status === "published").length} 篇已发布`,
      icon: STAT_ICONS.articles,
    },
    {
      label: "首页区块",
      value: String(data.homeSections.length),
      note: "序号模块",
      icon: STAT_ICONS.sections,
    },
    {
      label: "自定义页面",
      value: String(data.pages.length),
      note: data.pages.filter((p) => p.inNav).length + " 个在导航",
      icon: STAT_ICONS.pages,
    },
  ]

  return (
    <div className="space-y-5">
      <SetupChecklist />
      {/* 顶部：标题 + 状态 + 操作 */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
        <div aria-hidden className="ambient pointer-events-none absolute -right-16 -top-16 size-52 opacity-50" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[26px] font-extrabold tracking-[-0.02em]">运营工作台</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                  hasDraftChanges
                    ? "border border-amber-500/30 bg-amber-500/10 text-amber-700"
                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                }`}
              >
                {hasDraftChanges ? `${Object.keys(draft).length} 个切片有未发布改动` : "草稿与站点一致"}
              </span>
            </div>
            <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-muted-foreground">
              网站内容与外观的统一编辑入口：左侧选模块 → 中间编辑内容 → 右侧实时预览草稿；点「发布」后站点前台才会生效。所有修改自动保存到浏览器本地，不丢内容。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {hasDraftChanges && (
              <Button
                className="gap-1.5"
                onClick={() => {
                  if (window.confirm(PUBLISH_CONFIRM_TEXT)) publishAll()
                }}
              >
                <Rocket className="size-3.5" />
                发布全部草稿到站点
              </Button>
            )}
            <Button asChild variant="outline" className="gap-1.5">
              <a href="#/" target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                打开站点前台
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* 三步引导：让使用者一眼知道工作台怎么用 */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { n: "1", t: "选模块", d: "左侧导航点你要改的模块" },
          { n: "2", t: "编辑内容", d: "中间按「组」折叠编辑，改动自动存草稿" },
          { n: "3", t: "发布生效", d: "点「发布」后，站点前台立即更新" },
        ].map(({ n, t, d }) => (
          <div key={n} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-[14px] font-bold text-accent-foreground">
              {n}
            </span>
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold">{t}</div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{d}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 核心数据统计卡 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-5"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary/70 via-accent2/60 to-transparent"
              />
              <span className="grid size-10 place-items-center rounded-xl border border-primary/15 bg-primary/5 text-primary">
                <Icon className="size-5" />
              </span>
              <div className="num text-gradient mt-3 text-[30px] font-extrabold tracking-[-0.02em]">
                {s.value}
              </div>
              <div className="mt-1 text-[14px] font-semibold">{s.label}</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">{s.note}</div>
            </div>
          )
        })}
      </div>

      {/* 草稿 / 已发布状态 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`size-2.5 shrink-0 rounded-full ${
              hasDraftChanges ? "bg-amber-500" : "bg-emerald-500"
            }`}
          />
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold">
              {hasDraftChanges ? "有草稿未发布" : "草稿与站点一致"}
            </div>
            <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              草稿键 {DRAFT_KEY} · 已发布键 {PUBLISHED_KEY}
              {lastDraftSavedAt
                ? ` · 草稿最后保存 ${new Date(lastDraftSavedAt).toLocaleTimeString()}`
                : " · 尚无草稿修改"}
              {lastPublishedAt ? ` · 上次发布 ${new Date(lastPublishedAt).toLocaleTimeString()}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* v1.1 数据源：本机缓存 → 飞书多维表格（契约已冻结，未接入） */}
      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-primary" />
            <span className="text-[14.5px] font-semibold">数据源</span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              {bitableReady() ? "已接入" : "未接入 · 本机缓存"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onShowDataSource?.()}
            className="text-[12px] font-medium text-primary hover:underline"
          >
            查看 {BITABLE_TABLES.length} 张表与待填项
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">当前存储</div>
            <div className="mt-0.5 text-[13px] font-medium">本机 localStorage（草稿 / 已发布 / 会话）</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">目标存储（v1.1）</div>
            <div className="mt-0.5 text-[13px] font-medium">
              飞书多维表格 · 一表一类 · {BITABLE_TABLES.length} 张表
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          本轮只落表结构与读写契约（PRD 附录 A.7），尚未真实连接：发布仍写本机，不构成落库成功。接入后此处切为「已接入」。
        </p>
      </div>

    </div>
  )
}

/* ---------------- 主题与排版：主题库 + 微调层 ---------------- */

function ThemeEditor() {
  const { data, setSlices } = useSiteStore()
  const theme = data.theme

  /** 应用整套主题包：覆盖内容切片 + 设计令牌（accent / accent2 / density） */
  const applyPack = (pack: ThemePack) => {
    setSlices({
      hero: pack.hero as EditableData["hero"],
      stats: pack.stats as EditableData["stats"],
      valueProps: pack.valueProps as unknown as EditableData["valueProps"],
      audiences: pack.audiences as unknown as EditableData["audiences"],
      solutions: pack.solutions as EditableData["solutions"],
      articles: pack.articles as EditableData["articles"],
      samples: pack.samples as unknown as EditableData["samples"],
      demos: (PACK_DEMOS[pack.id] ?? data.demos) as unknown as EditableData["demos"],
      footerBoundary: pack.footerBoundary,
      theme: { ...theme, accent: pack.accent, accent2: pack.accent2, density: pack.density },
    })
  }

  /** 当前配色是否与该主题一致（用于「当前应用」标记） */
  const isActivePack = (pack: ThemePack) => theme.accent === pack.accent && theme.accent2 === pack.accent2

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-[16px] font-bold">主题与排版</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          先选一套行业主题：一键应用整套内容与配色；再用下面的微调项覆盖细节。
          修改进入草稿，右侧预览可见效果，发布后前台生效。
        </p>
      </div>

      {/* 主题库 */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-1 text-[14px] font-bold">主题库</div>
        <p className="mb-4 text-[12px] text-muted-foreground">
          每套主题 = 首页内容 + 能力模块 + 文章样例 + 配色与密度。应用会覆盖当前这些内容切片。
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_PACKS.map((pack) => {
            const active = isActivePack(pack)
            return (
              <div
                key={pack.id}
                className={`group flex flex-col gap-3 rounded-lg border p-3.5 transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border hover:border-border/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: pack.accent }} />
                    <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: pack.accent2 }} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {active && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
                        当前应用
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                        pack.tier === "主推" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {pack.tier}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold">{pack.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                    {pack.tagline}
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="text-[10.5px] text-muted-foreground">
                    {pack.solutions.length} 个能力模块 · {pack.articles.length} 篇文章
                  </span>
                  {active ? (
                    <span className="text-[11px] font-medium text-primary/80">已应用 · 可继续微调</span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => applyPack(pack)}>
                      应用该主题
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 微调层：应用主题后覆盖细节 */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div>
          <div className="text-[13.5px] font-bold">微调（可选）</div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            应用主题会恢复该主题的默认设计；这里的微调仅覆盖当前配置，不写入主题包。
          </p>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold">强调色</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => setSlices({ theme: { ...theme, accent: p.hex } })}
                className={`group flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors ${
                  theme.accent === p.hex ? "border-primary" : "border-border hover:border-border/70"
                }`}
              >
                <span
                  className="size-7 rounded-md border border-black/5"
                  style={{ backgroundColor: p.hex }}
                />
                <span className="text-[10.5px] text-muted-foreground">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="text-[12.5px] text-muted-foreground">自定义色值</label>
            <input
              type="color"
              value={theme.accent}
              onChange={(e) => setSlices({ theme: { ...theme, accent: e.target.value } })}
              className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
            />
            <span className="num text-[12.5px] text-muted-foreground">{theme.accent}</span>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold">渐变副色</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {ACCENT2_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                onClick={() => setSlices({ theme: { ...theme, accent2: p.hex } })}
                className={`group flex flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors ${
                  theme.accent2 === p.hex ? "border-primary" : "border-border hover:border-border/70"
                }`}
              >
                <span
                  className="size-7 rounded-md border border-black/5"
                  style={{ backgroundColor: p.hex }}
                />
                <span className="text-[10.5px] text-muted-foreground">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className="text-[12.5px] text-muted-foreground">自定义色值</label>
            <input
              type="color"
              value={theme.accent2}
              onChange={(e) => setSlices({ theme: { ...theme, accent2: e.target.value } })}
              className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
            />
            <span className="num text-[12.5px] text-muted-foreground">{theme.accent2}</span>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold">页面密度</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                { key: "compact", label: "紧凑", desc: "更少留白，信息密集" },
                { key: "normal", label: "标准", desc: "当前默认节奏" },
                { key: "relaxed", label: "宽松", desc: "更多留白，呼吸感" },
              ] as const
            ).map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setSlices({ theme: { ...theme, density: d.key } })}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  theme.density === d.key ? "border-primary bg-primary/5" : "border-border hover:border-border/70"
                }`}
              >
                <div className="text-[13px] font-medium">{d.label}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[13px] font-semibold">首页路由映射</div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            {theme.homePageSlug ? (
              (() => {
                const page = data.pages.find((p) => p.slug === theme.homePageSlug)
                return (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[12.5px] leading-relaxed">
                      <span className="text-muted-foreground">当前首页已映射到：</span>
                      <span className="font-medium text-foreground">
                        {page ? page.title : theme.homePageSlug}
                      </span>
                      <span className="ml-1 text-[11.5px] text-muted-foreground">
                        （/ 路由渲染该页面区块）
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        setSlices({ theme: { ...theme, homePageSlug: undefined } })
                      }
                    >
                      <RefreshCcw className="size-3.5" />
                      恢复内置首页
                    </Button>
                  </div>
                )
              })()
            ) : (
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                当前使用内置首页。在「页面管理」把某个自定义页面「设为首页」，即可把首页换成区块化页面。
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="text-[13px] font-semibold">形象图 URL（选填）</div>
            <input
              type="text"
              value={theme.avatarUrl}
              onChange={(e) => setSlices({ theme: { ...theme, avatarUrl: e.target.value } })}
              placeholder="https://…/avatar.png"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/60"
            />
            <p className="text-[11.5px] text-muted-foreground">
              留空则显示占位字「H」。原型阶段不上传文件，仅支持网络图片 URL。
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="text-[13px] font-semibold">品牌字 / 占位字</div>
            <input
              type="text"
              value={theme.avatarLetter}
              onChange={(e) => setSlices({ theme: { ...theme, avatarLetter: e.target.value || "H" } })}
              maxLength={2}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/60"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- 发布与导出 ---------------- */

function toYaml(v: unknown, indent = 0): string {
  const pad = "  ".repeat(indent)
  if (typeof v === "string") return JSON.stringify(v)
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (v === null || v === undefined) return "null"
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]"
    const lines = v.map((item) => {
      if (typeof item === "object" && item !== null) {
        return `${pad}-\n${toYaml(item, indent + 1)}`
      }
      return `${pad}- ${toYaml(item, indent)}`
    })
    return lines.join("\n")
  }
  if (typeof v === "object") {
    const lines = Object.entries(v as Record<string, unknown>).map(([k, val]) => {
      if (typeof val === "object" && val !== null) {
        return `${pad}${k}:\n${toYaml(val, indent + 1)}`
      }
      return `${pad}${k}: ${toYaml(val, indent)}`
    })
    return lines.join("\n")
  }
  return String(v)
}

function Publish() {
  const { data, published, hasDraftChanges, publishAll, resetSlice, resetPublished, lastPublishedAt } =
    useSiteStore()
  const [notice, setNotice] = useState("")

  const download = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportYaml = () => {
    const yaml = toYaml(data as unknown as Record<string, unknown>)
    download("hugow-site-data.yaml", yaml, "application/yaml;charset=utf-8")
    setNotice("已导出 YAML（含全部切片当前值）")
  }

  const exportTs = () => {
    const ts = `/* HugoW个人门户 · 站点数据导出（${new Date().toISOString().slice(0, 10)}）\n * 生成自运营工作台。将此文件中的覆盖数据合入 data/*.ts 默认值即可固化。 */\n\nexport const SITE_DATA_EXPORT = ${JSON.stringify(data, null, 2)} as const\n`
    download("hugow-site-data.ts", ts, "text/typescript;charset=utf-8")
    setNotice("已导出 TS（覆盖数据常量，可合入 data 文件）")
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-[16px] font-bold">发布与导出</h2>
        <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">
          编辑写入草稿并自动保存；点「发布」后站点前台才生效。导出文件固化的是当前工作台数据
          （草稿态），正式站合入时以最后一次发布结果为准。
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold">
              {hasDraftChanges ? "有未发布的草稿改动" : "草稿与站点已一致"}
            </h3>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {lastPublishedAt
                ? `上次发布：${new Date(lastPublishedAt).toLocaleTimeString()}。`
                : "尚未发布过。"}
              已发布切片：{Object.keys(published).length} 个。
            </p>
          </div>
          <Button
            className="gap-1.5"
            disabled={!hasDraftChanges}
            onClick={() => {
              if (window.confirm(PUBLISH_CONFIRM_TEXT)) publishAll()
            }}
          >
            <Rocket className="size-3.5" />
            {hasDraftChanges ? "发布全部草稿" : "已是最新"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={exportYaml}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
        >
          <Download className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <span className="block text-[14px] font-semibold">导出 YAML</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-muted-foreground">
              完整站点数据，适合作为正式站 data/*.yml 的数据源。
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={exportTs}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
        >
          <FileCode2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>
            <span className="block text-[14px] font-semibold">导出 TS</span>
            <span className="mt-1 block text-[12.5px] leading-relaxed text-muted-foreground">
              生成 TypeScript 覆盖常量，可直接合入原型 data 文件固化。
            </span>
          </span>
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-[13px]">
          {notice}
        </div>
      )}

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="text-[14px] font-semibold text-destructive">危险操作</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          重置草稿：丢弃全部未发布修改（已发布内容不受影响）。重置已发布：站点前台回到 data/*.ts 默认值。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive"
            onClick={() => resetSlice()}
          >
            <RefreshCcw className="size-3.5" />
            丢弃全部草稿
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={resetPublished}>
            <RefreshCcw className="size-3.5" />
            重置已发布为默认
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- 主布局 ---------------- */

export function AdminPage() {
  const [tab, setTab] = useState<TabKey>("overview")
  const { hasDraftChanges, publishAll, lastDraftSavedAt } = useSiteStore()
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>({ path: "/", anchor: "hero" })
  // FR-AUTH：会话来自 localStorage（原型为模拟飞书账号）
  const [user] = useState(() => loadSession())
  // FR-BE：数据源说明面板（v1.1 契约已冻结，多维表格尚未接入）
  const [dataSourceOpen, setDataSourceOpen] = useState(false)
  const bitableOn = bitableReady()
  const onSignOut = useCallback(() => {
    signOut()
    window.location.hash = "#/login/"
  }, [])

  const onLocate = useCallback((target: PreviewTarget) => {
    setPreviewTarget(target)
  }, [])

  const sliceForTab: Partial<Record<TabKey, SliceKey>> = {
    site: "site",
    home: "hero",
    solutions: "solutions",
    writing: "articles",
    method: "method",
    about: "about",
  }

  const renderBody = () => {
    switch (tab) {
      case "overview":
        return <Overview onShowDataSource={() => setDataSourceOpen(true)} />
      case "site":
        return (
          <>
            <SliceEditor sliceKey="site" title="品牌与联系方式" desc="全站品牌名、简短标识、邮箱与响应口径。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="nav" title="顶部导航" desc="主导航条目：名称 + 跳转链接。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="cta" title="常驻 CTA 与联系区" desc="页头右侧按钮 + 首页「联系一下」区：主按钮文案/跳转、右侧拟人图、微信二维码图（可上传或粘贴链接）与二维码说明；联系方式里的邮箱/坐标作为底部副信息。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="footerColumns" title="页脚栏目" desc="页脚四栏导航。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="footerBoundary" title="页脚边界声明" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="footerAigc" title="页脚 AIGC 标识" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor
              sliceKey="pageSettings"
              title="二级页页面设置"
              desc="能做什么 / 怎么交付 / 大家评价 / 我在写 / 分享区 / 关于我 的页面标题与导语。留空导语的页面回退各自数据切片的口径。"
              onLocate={onLocate}
            />
            <div className="mt-4" />
            <SliceEditor
              sliceKey="contact"
              title="联系页文案"
              desc="联系 / 预约落地页标题、导语、侧栏信息与表单文案（缺省回退默认文案）。"
              onLocate={onLocate}
            />
          </>
        )
      case "home":
        return (
          <>
            <SliceEditor sliceKey="hero" title="首页人设区" desc="眉标、主标题、导语、气泡语、个人标签、GitHub 链接、头像图与头像区背景图（填 URL）。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="stats" title="数字条" desc="统计数字 + 口径说明（可编辑，勿编造无依据数据）。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="valueProps" title="价值主张" desc="三个核心卖点卡。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="homeSections" title="首页序号模块" desc="首页 01—07 区块的编号、标题与导语。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="testimonials" title="大家评价" desc="首页「大家评价」区：客户原话、称呼、岗位与关联产品（发布前替换为真实客户口吻）。" onLocate={onLocate} />
          </>
        )
      case "products":
        return (
          <>
            <SliceEditor sliceKey="products" title="产品卡片" desc="首页「我的产品」自动轮播卡：产品图片、介绍、个性标签、分类标签、产品链接（点击跳转）。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="productCarousel" title="轮播设置" desc="「我的产品」自动轮播间隔（毫秒，如 4000 = 4 秒；前台夹在 2—30 秒）。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="demoVideos" title="演示视频" desc="「产品与演示」区视频：封面、标题、时长与视频地址。视频按产品关联后，前台左侧产品列点选即播。" onLocate={onLocate} />
          </>
        )
      case "shares":
        return (
          <SliceEditor sliceKey="shares" title="分享内容" desc="首页「分享区」：GitHub 项目 / 博主文章 / 好工具，含主题、标题、一句话与跳转链接。" onLocate={onLocate} />
        )
      case "solutions":
        return <SliceEditor sliceKey="solutions" title="能力模块" desc="每个模块含标题、人群、问题、能力、交付物、边界、技术栈、演示信息、证据与正文。" onLocate={onLocate} />
      case "writing":
        return (
          <>
            <SliceEditor sliceKey="articles" title="文章" desc="status 为 published 才会展示。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="samples" title="交付物样例" desc="案例页展示的脱敏样例。" onLocate={onLocate} />
          </>
        )
      case "method":
        return (
          <>
            <SliceEditor sliceKey="method" title="交付方法" desc="流程、价格、不承诺、边界。" onLocate={onLocate} />
            <div className="mt-4" />
            <SliceEditor sliceKey="faqGroups" title="FAQ" desc="分组问答。" onLocate={onLocate} />
          </>
        )
      case "about":
        return <SliceEditor sliceKey="about" title="关于我" desc="履历时间线、工作原则、边界。" onLocate={onLocate} />
      case "pages":
        return (
          <PageManager
            onLocate={(t) =>
              setPreviewTarget({
                path: t.path,
                anchor: t.anchor,
                groupAnchor: t.groupAnchor,
              })
            }
          />
        )
      case "theme":
        return <ThemeEditor />
      case "publish":
        return <Publish />
    }
  }

  // tab 切换时同步预览定位
  useEffect(() => {
    if (tab === "overview" || tab === "publish" || tab === "theme") {
      setPreviewTarget({ path: "/", anchor: "hero" })
      return
    }
    const k = (sliceForTab[tab] ?? tab) as SliceKey
    const t = PREVIEW_TARGET[k] ?? PREVIEW_TARGET.hero
    setPreviewTarget({ path: t.path, anchor: t.anchor })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // FR-AUTH：无有效会话时不渲染任何编辑界面，只给登录入口
  if (!user) return <AdminLoginGate />

  return (
    <OnboardingProvider>
    <div className="min-h-screen bg-background text-foreground">
      {/* 顶栏 */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-[12px] font-bold text-primary-foreground">
              H
            </span>
            <span className="text-[14px] font-semibold">运营工作台</span>
            <span className="hidden text-[12px] text-muted-foreground sm:inline">
              HugoW个人门户 · 原型
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* 数据源：v1.1 目标为飞书多维表格，原型阶段仍写本机 */}
            <button
              type="button"
              onClick={() => setDataSourceOpen((v) => !v)}
              title="查看数据源说明"
              className="hidden items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted md:flex"
            >
              <Database className="size-3.5" />
              {bitableOn ? "飞书多维表格" : "本机缓存"}
            </button>
            {/* 草稿自动保存状态 */}
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium md:flex ${
                hasDraftChanges
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              }`}
            >
              <Save className="size-3.5" />
              {hasDraftChanges
                ? `草稿已自动保存${lastDraftSavedAt ? " · " + new Date(lastDraftSavedAt).toLocaleTimeString() : ""}`
                : "草稿与站点一致"}
            </span>
            {hasDraftChanges && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (window.confirm(PUBLISH_CONFIRM_TEXT)) publishAll()
                }}
              >
                <Rocket className="size-3.5" />
                发布全部
              </Button>
            )}
            <OnboardingChip />
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <a href="#/" rel="noreferrer">
                <ExternalLink className="size-3.5" />
                查看站点
              </a>
            </Button>
            {/* 当前管理员：头像 / 姓名 / open_id 尾号（真实阶段取自飞书 user_info） */}
            <div className="flex items-center gap-2 border-l border-border pl-2.5">
              <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted text-[11px] font-semibold">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
                ) : (
                  user.name.slice(0, 1)
                )}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[12px] font-semibold">{user.name}</span>
                <span className="block text-[10.5px] text-muted-foreground">
                  飞书 · {shortOpenId(user.openId)}
                </span>
              </span>
              <button
                type="button"
                onClick={onSignOut}
                title="退出登录"
                aria-label="退出登录"
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      {/* 数据源说明（FR-BE 契约展示；未接入） */}
      {dataSourceOpen && (
        <div className="absolute right-4 top-full z-50 mt-1 w-[430px] rounded-2xl border border-border bg-background p-4 shadow-[0_18px_50px_-16px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold">数据源</span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-700">
                {bitableOn ? "已接入" : "未接入 · 本机缓存"}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              v1.1 已把数据后端定为飞书多维表格（一表一类，共 {BITABLE_TABLES.length} 张表）。
              本轮只落表结构与读写契约，读写仍走本机：草稿键、已发布键、会话键。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
              <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                <div className="text-[10.5px] text-muted-foreground">当前存储</div>
                <div className="mt-0.5 font-medium">本机 localStorage</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-2">
                <div className="text-[10.5px] text-muted-foreground">目标存储</div>
                <div className="mt-0.5 font-medium">飞书多维表格 · {BITABLE_TABLES.length} 张表</div>
              </div>
            </div>
            <div className="mt-3 text-[10.5px] font-medium text-muted-foreground">
              表清单（字段契约见 PRD 附录 A.7）
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              {BITABLE_TABLES.map((t) => (
                <div key={t.table} className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate font-mono text-[10.5px] text-foreground">{t.table}</span>
                  <span className="truncate text-[10px] text-muted-foreground">{t.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-border bg-muted/30 px-2.5 py-2 text-[11px] text-muted-foreground">
              待填：app_token / table_id / 回调域名 / 网关落点（PRD §6 O-8、O-9）。填齐后本面板切为「已接入」。
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setDataSourceOpen(false)}>
                知道了
              </Button>
            </div>
          </div>
      )}
      </header>

      <div className="mx-auto flex w-full max-w-[1560px] gap-6 px-5 py-6">
        {/* 侧栏 */}
        <nav className="w-[180px] shrink-0 space-y-1" aria-label="工作台导航">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rail-item flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  active ? "rail-item-active bg-muted/60" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{t.label}</span>
              </button>
            )
          })}
        </nav>

        {/* 编辑区 */}
        <main className="min-w-0 flex-1 pb-24">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold tracking-[-0.02em]">
              {TABS.find((t) => t.key === tab)?.label}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {TABS.find((t) => t.key === tab)?.hint}
            </p>
          </div>
          {renderBody()}
        </main>

        {/* 右侧预览 */}
        <PreviewPane target={previewTarget} />
      </div>
      <OnboardingWizard onNavigateTab={(t) => setTab(t as TabKey)} />
    </div>
    </OnboardingProvider>
  )
}
