import { Link, NavLink, useParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { useSiteData } from "@/site/admin/store"
import { ArticleCard } from "@/site/components/ArticleCard"
import { Container } from "@/site/components/Layout"
import { CATEGORY_LABELS } from "@/site/data/site"

const CATEGORIES = ["case", "insight", "guide"] as const

/** 我在写：文章索引（分类自动发现；页头标题/导语来自工作台「二级页页面设置」）。 */
export function WritingPage() {
  const { category } = useParams<{ category?: string }>()
  const { articles, pageSettings } = useSiteData()
  const published = articles.filter((a) => a.status === "published")
  const active = category && CATEGORIES.includes(category as (typeof CATEGORIES)[number])
    ? category
    : undefined
  const ps = pageSettings.writing

  const list = active
    ? published.filter((a) => a.category === active)
    : published

  return (
    <div data-preview-anchor="articles" className="px-6 py-14 md:px-8 md:py-20">
      <Container>
        <div className="max-w-2xl">
          <h1 className="text-gradient text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold tracking-[-0.03em] text-balance">
            {ps.title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {ps.lead}
          </p>
        </div>

        {/* 分类切换 */}
        <div className="mt-10 flex flex-wrap items-center gap-2">
          <NavLink
            to="/writing/"
            end
            className={({ isActive }) =>
              `rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                isActive && !active
                  ? "border-primary bg-primary text-primary-foreground shadow-glow"
                  : "border-border bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`
            }
          >
            全部
          </NavLink>
          {CATEGORIES.map((c) => (
            <NavLink
              key={c}
              to={`/writing/${c}/`}
              className={({ isActive }) =>
                `rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-glow"
                    : "border-border bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                }`
              }
            >
              {CATEGORY_LABELS[c]}
            </NavLink>
          ))}
        </div>

        {/* 列表 */}
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>

        {list.length === 0 && (
          <p className="mt-10 text-[14px] text-muted-foreground">这个分类还没有已发布的内容。</p>
        )}

        {/* 订阅引导 */}
        <div className="glass-card mt-16 flex flex-wrap items-center justify-between gap-4 rounded-xl px-6 py-5">
          <div>
            <h3 className="text-[15px] font-semibold">不想错过更新</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              站点文章同步发布到公众号；也可以直接加微信，备注「订阅」。
            </p>
          </div>
          <Badge variant="outline" className="font-normal">
            公众号 · 微信同名
          </Badge>
        </div>

        {/* 相关模块引导 */}
        <div className="mt-10">
          <p className="text-[13px] text-muted-foreground">
            想直接看能做什么，而不是读文章？
            <Link to="/solutions/" className="ml-1 font-medium text-primary hover:text-primary/80">
              去模块列表 →
            </Link>
          </p>
        </div>
      </Container>
    </div>
  )
}
