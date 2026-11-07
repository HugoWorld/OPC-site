import { useMemo } from "react"
import { Quote } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useSiteData } from "@/site/admin/store"
import { TESTIMONIALS } from "@/site/data/home"

/**
 * 首页「大家评价」：服务过的客户怎么说。
 * - 评价卡：大引号 + 客户原话 + 作者行（头像字母 + 称呼 + 岗位）+ 关联产品徽章；
 * - 数据由工作台「首页内容 → 大家评价」切片驱动（可增删、可停用）；
 * - 默认 3 条示例评价，发布前替换为真实客户口吻。
 */
export function TestimonialsSection() {
  const { testimonials } = useSiteData()
  const list = useMemo(
    () =>
      (testimonials.length > 0 ? [...testimonials] : TESTIMONIALS)
        .filter((t) => t.published !== false)
        .sort((a, b) => a.order - b.order),
    [testimonials]
  )
  if (list.length === 0) return null

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {list.map((t) => (
        <figure
          key={t.id}
          className="glass-card card-hover group relative flex flex-col rounded-2xl p-7 md:p-8"
        >
          <Quote className="absolute right-6 top-6 size-7 text-primary/15 transition group-hover:text-primary/30" />
          <blockquote className="flex-1 text-[15px] leading-[1.9] text-foreground/90 text-pretty">
            “{t.quote}”
          </blockquote>
          <figcaption className="mt-8 flex items-center gap-4 border-t border-border/60 pt-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-accent2/15 text-[16px] font-bold text-primary ring-1 ring-primary/20">
              {t.author.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-bold">{t.author}</span>
              <span className="mt-1 block truncate text-[12.5px] text-muted-foreground">{t.role}</span>
            </span>
          </figcaption>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/50 pt-4">
            <span className="text-[11.5px] text-muted-foreground">关联项目</span>
            <Badge variant="secondary" className="border-border/60 bg-muted/60 text-[11.5px]">
              {t.project}
            </Badge>
          </div>
        </figure>
      ))}
    </div>
  )
}
