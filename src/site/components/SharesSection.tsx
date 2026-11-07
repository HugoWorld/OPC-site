import { useMemo, useState } from "react"
import { ArrowRight, ArrowUpRight, Github, Newspaper, Sparkles, Wrench } from "lucide-react"
import { Link } from "react-router-dom"

import { useSiteData } from "@/site/admin/store"
import { SHARE_KIND_LABELS, SHARES_SORTED, type Share, type ShareKind } from "@/site/data/shares"

const KIND_ICON: Record<ShareKind, typeof Github> = {
  github: Github,
  article: Newspaper,
  tool: Wrench,
}

const KIND_TABS: { key: ShareKind | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "github", label: "GitHub 项目" },
  { key: "article", label: "博主文章" },
  { key: "tool", label: "好工具" },
]

/** 每个 tab 最多呈现的卡片数，超出在右下角「查看更多」跳全览页 */
const MAX_PER_TAB = 3

/**
 * 首页「分享区」：按主题分享 GitHub 项目 / 博主文章 / 顺手做的小工具。
 * 每个 tab 最多展示 3 条，超出后在右下角提供「查看更多」跳转全览页。
 * 数据由工作台「分享管理」切片驱动；默认给真实可点开的开源项目示例。
 */
export function SharesSection() {
  const { shares } = useSiteData()
  const [kind, setKind] = useState<ShareKind | "all">("all")

  const list = useMemo(
    () =>
      (shares.length > 0 ? [...shares] : SHARES_SORTED)
        .filter((s) => s.published !== false)
        .sort((a, b) => a.order - b.order)
        .filter((s) => kind === "all" || s.kind === kind),
    [shares, kind]
  )

  // 每个 tab 的数量（「全部」= 各自类型数量总和展示）
  const tabCount = (t: (typeof KIND_TABS)[number]) =>
    t.key === "all"
      ? list.length
      : (shares.length > 0 ? [...shares] : SHARES_SORTED).filter(
          (s) => s.published !== false && s.kind === t.key
        ).length

  const shown = list.slice(0, MAX_PER_TAB)
  const hasMore = list.length > MAX_PER_TAB

  return (
    <div>
      {/* 类型筛选 */}
      <div className="mb-8 flex flex-wrap gap-2">
        {KIND_TABS.map((t) => {
          const count = tabCount(t)
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setKind(t.key)}
              aria-pressed={kind === t.key}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                kind === t.key
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "border border-border bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {t.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <div className="glass-card rounded-2xl px-6 py-10 text-center">
          <Sparkles className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-[14px] font-medium">这个分类还没有内容</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            到工作台「分享管理」添加你的真实分享（GitHub 项目 / 博主文章 / 好工具）。
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <ShareCard key={s.id} share={s} />
          ))}
        </div>
      )}

      {/* 查看更多：超出 3 条时右下角跳全览页 */}
      {hasMore && (
        <div className="mt-5 flex justify-end">
          <Link
            to="/shares/"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/8 px-4 py-2 text-[13px] font-semibold text-primary transition hover:bg-primary/15"
          >
            查看更多 {kind === "all" ? "全部" : SHARE_KIND_LABELS[kind as ShareKind]}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

function ShareCard({ share: s }: { share: Share }) {
  const Icon = KIND_ICON[s.kind]
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group glass-card card-hover flex flex-col rounded-2xl p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <Icon className="size-3.5" />
          {SHARE_KIND_LABELS[s.kind]}
        </span>
        <span className="rounded-md bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {s.topic}
        </span>
      </div>
      <h3 className="mt-4 text-[15.5px] font-bold tracking-[-0.01em]">
        {s.title}
        {s.author ? <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">· {s.author}</span> : null}
      </h3>
      <p className="mt-2.5 flex-1 text-[13px] leading-[1.7] text-muted-foreground text-pretty">{s.note}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
        打开 <ArrowUpRight className="size-3.5" />
      </span>
    </a>
  )
}
