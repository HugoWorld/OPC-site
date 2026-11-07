import { Link } from "react-router-dom"
import { ArrowUpRight, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { CATEGORY_LABELS } from "@/site/data/site"
import type { Article } from "@/site/data/writing"

/** 阅读时长估算：按正文字符数粗估，原型展示用。 */
export function readingMinutes(article: Article): string {
  const chars = article.body.join("").replace(/[#>\-|*\[\]`]/g, "").length
  const mins = Math.max(3, Math.round(chars / 400))
  return `${mins} 分钟`
}

/** 文章卡：结论优先——大号渐变标题 + 高亮结论块 + 彩色标签尾行。 */
export function ArticleCard({ article }: { article: Article }) {
  return (
    <Card className="group glass-card card-hover gap-0 overflow-hidden py-0">
      <Link
        to={`/writing/${article.category}/${article.slug}/`}
        className="relative flex flex-col p-6"
      >
        {/* 顶部渐变光带 + 角部光斑（hover 增强） */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary via-accent2 to-transparent" />
        <div
          aria-hidden
          className="ambient pointer-events-none absolute -right-12 -top-12 size-36 opacity-40 transition-opacity duration-500 group-hover:opacity-70"
        />

        <div className="relative flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/5 px-2.5 py-0.5 font-medium text-primary"
          >
            {CATEGORY_LABELS[article.category]}
          </Badge>
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Clock className="size-3.5" />
            {article.date} · {readingMinutes(article)}
          </span>
        </div>

        <h3 className="text-gradient mt-4 text-[18px] leading-snug font-bold tracking-[-0.015em] text-balance">
          {article.title}
        </h3>

        <p className="mt-3.5 rounded-xl border border-primary/15 bg-accent/45 px-3.5 py-3 text-[14px] leading-relaxed text-foreground/90">
          {article.takeaway}
        </p>

        <p className="mt-3.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted-foreground">
          {article.summary}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted-foreground">
          {article.tags.slice(0, 3).map((t) => (
            <span key={t} className="font-medium text-primary/70">
              #{t}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-foreground transition-colors group-hover:text-primary">
            阅读全文
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </Link>
    </Card>
  )
}
