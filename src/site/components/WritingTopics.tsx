import { useMemo } from "react"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

import { useSiteData } from "@/site/admin/store"
import { CATEGORY_LABELS } from "@/site/data/site"
import type { Article } from "@/site/data/writing"

/** 主题卡配色（浅色明快四色系，从HugoW「按主题找文章」样式借鉴） */
const CAT_COLOR: Record<string, { card: string; badge: string }> = {
  case: {
    card: "border-rose-500/25 bg-gradient-to-b from-rose-500/12 to-rose-500/3",
    badge: "bg-rose-500/15 text-rose-700",
  },
  insight: {
    card: "border-amber-500/25 bg-gradient-to-b from-amber-500/12 to-amber-500/3",
    badge: "bg-amber-500/15 text-amber-700",
  },
  guide: {
    card: "border-emerald-500/25 bg-gradient-to-b from-emerald-500/12 to-emerald-500/3",
    badge: "bg-emerald-500/15 text-emerald-700",
  },
}

const CATEGORY_ORDER = ["case", "insight", "guide"] as const

/**
 * 首页「按主题找文章」：按主题（文章分类）聚合，游客可快速按主题查阅。
 * 每主题一张彩卡：篇数 + 最多 3 篇标题（含日期）+「更多」跳转该主题列表页。
 * 数据全部来自已发布文章（分类自动发现，不写死主题）。
 */
export function WritingTopics() {
  const { articles } = useSiteData()
  const published = useMemo(
    () =>
      articles
        .filter((a) => a.status === "published")
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [articles]
  )
  const groups = useMemo(() => {
    const map = new Map<string, Article[]>()
    published.forEach((a) => {
      const arr = map.get(a.category) ?? []
      arr.push(a)
      map.set(a.category, arr)
    })
    return CATEGORY_ORDER.map((c) => ({ category: c, items: map.get(c) ?? [] })).filter(
      (g) => g.items.length > 0
    )
  }, [published])

  if (groups.length === 0) return null

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((g) => {
        const color = CAT_COLOR[g.category] ?? CAT_COLOR.guide
        return (
          <div
            key={g.category}
            className={`group flex flex-col rounded-2xl border p-5 ${color.card}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${color.badge}`}
              >
                {CATEGORY_LABELS[g.category] ?? g.category}
              </span>
              <span className="text-[12px] font-medium text-muted-foreground">
                {g.items.length} 篇
              </span>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              {g.category === "case" && "复盘交付现场，只写改了什么、还剩什么没解决。"}
              {g.category === "insight" && "行业判断与边界，观点都标得出依据。"}
              {g.category === "guide" && "上手方法：照着做就能跑通的那类。"}
            </p>
            <ul className="mt-4 flex-1 space-y-2.5">
              {g.items.slice(0, 3).map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/writing/${g.category}/${a.slug}/`}
                    className="group/link block rounded-lg px-2 py-1.5 transition hover:bg-card/70"
                  >
                    <span className="line-clamp-2 text-[13.5px] leading-snug font-semibold text-foreground group-hover/link:text-primary">
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                      {a.date.replace(/-/g, ".")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border/50 pt-3">
              <Link
                to={`/writing/${g.category}/`}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary transition group-hover:gap-1.5"
              >
                更多 {CATEGORY_LABELS[g.category] ?? g.category}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
