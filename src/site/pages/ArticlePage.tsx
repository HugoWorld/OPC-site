import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSiteData } from "@/site/admin/store"
import { Container } from "@/site/components/Layout"
import { CATEGORY_LABELS } from "@/site/data/site"
import { readingMinutes } from "@/site/components/ArticleCard"
import { NotFoundPage } from "@/site/pages/NotFoundPage"

/** 文章正文页：结论优先 + 相关模块交叉链接 + 继续读。 */
export function ArticlePage() {
  const { category, slug } = useParams<{ category: string; slug: string }>()
  const { articles, solutions } = useSiteData()
  const article =
    category && slug
      ? articles.find((a) => a.category === category && a.slug === slug)
      : undefined

  if (!article) return <NotFoundPage />

  const relatedModules = article.modules
    .map((m) => solutions.find((s) => s.id === m))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
  const related = articles
    .filter((a) => a.status === "published" && a.slug !== article.slug)
    .slice(0, 2)

  return (
    <div className="px-6 py-14 md:px-8 md:py-20">
      <Container className="max-w-[760px]">
        {/* 面包屑 */}
        <Link
          to="/writing/"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          全部文章
        </Link>

        {/* 元信息 */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="font-normal">
            {CATEGORY_LABELS[article.category]}
          </Badge>
          <span className="text-[13px] text-muted-foreground">{article.date}</span>
          <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
            <Clock className="size-3.5" />
            {readingMinutes(article)} 阅读
          </span>
        </div>

        <h1 className="text-gradient mt-5 text-[clamp(1.7rem,3.6vw,2.6rem)] font-extrabold leading-[1.2] tracking-[-0.03em] text-balance">
          {article.title}
        </h1>

        {/* 结论优先 */}
        <div className="glass-card mt-6 rounded-xl border-l-2 border-primary px-5 py-4">
          <div className="text-[12px] font-medium text-muted-foreground">一句话结论</div>
          <p className="mt-1.5 text-[15px] leading-relaxed font-medium">{article.takeaway}</p>
        </div>

        <p className="mt-6 text-[14px] leading-relaxed text-muted-foreground text-pretty">
          {article.summary}
        </p>

        {/* 正文 */}
        <article className="mt-10 space-y-5 text-[15px] leading-[1.85]">
          {article.body.map((line, i) => {
            if (line.startsWith("## ")) {
              return (
                <h2
                  key={i}
                  className="mt-10 mb-4 text-[clamp(1.3rem,2.4vw,1.6rem)] font-bold tracking-[-0.02em]"
                >
                  {line.slice(3)}
                </h2>
              )
            }
            if (line.startsWith("> ")) {
              return (
                <blockquote
                  key={i}
                  className="border-l-2 border-border pl-4 text-[14px] italic text-muted-foreground"
                >
                  {line.slice(2)}
                </blockquote>
              )
            }
            if (line.startsWith("- ")) {
              return (
                <ul key={i} className="list-disc space-y-2 pl-5">
                  <li>{renderInline(line.slice(2))}</li>
                </ul>
              )
            }
            if (/^\d+\.\s/.test(line)) {
              return (
                <div key={i} className="flex gap-3">
                  <span className="num mt-1 w-5 shrink-0 text-[13px] text-muted-foreground">
                    {line.match(/^\d+/)?.[0]}
                  </span>
                  <p className="min-w-0">{renderInline(line.replace(/^\d+\.\s/, ""))}</p>
                </div>
              )
            }
            if (line.startsWith("|")) {
              const cells = line
                .split("|")
                .filter((c) => c.trim() !== "")
                .map((c) => c.trim())
              if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return null
              return (
                <div key={i} className="glass-card overflow-x-auto rounded-lg">
                  <table className="w-full min-w-[420px] text-[13.5px]">
                    <tbody className="divide-y divide-border">
                      <tr className="bg-muted/50">
                        {cells.map((c, ci) => (
                          <th key={ci} className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )
            }
            return <p key={i}>{renderInline(line)}</p>
          })}
        </article>

        {/* 相关模块交叉链接 */}
        {relatedModules.length > 0 && (
          <section className="glass-card mt-14 rounded-xl p-6">
            <h3 className="text-[14px] font-semibold text-muted-foreground">这篇文章相关的模块</h3>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {relatedModules.map((m) => (
                <Link key={m.id} to={`/solutions/${m.id}/`}>
                  <Badge variant="outline" className="gap-1 px-3 py-1.5 text-[13px] font-normal transition-colors hover:border-primary hover:text-primary">
                    {m.title}
                    <ArrowRight className="size-3" />
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 继续读 */}
        {related.length > 0 && (
          <section className="mt-14">
            <h3 className="text-[14px] font-semibold text-muted-foreground">继续读</h3>
            <div className="mt-4 space-y-3">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/writing/${r.category}/${r.slug}/`}
                  className="group glass-card card-hover flex items-start justify-between gap-4 rounded-xl p-5"
                >
                  <div>
                    <div className="text-[13px] text-muted-foreground">
                      {CATEGORY_LABELS[r.category]} · {r.date}
                    </div>
                    <div className="mt-1.5 text-[15px] font-semibold leading-snug text-balance">
                      {r.title}
                    </div>
                    <div className="mt-1.5 text-[13px] text-muted-foreground line-clamp-2 text-pretty">
                      {r.takeaway}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 底部 CTA（玻璃 + 光斑） */}
        <section className="glass-card relative mt-14 overflow-hidden rounded-2xl px-8 py-10 text-center">
          <div aria-hidden className="ambient pointer-events-none absolute inset-0 opacity-70" />
          <h3 className="text-gradient relative text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em] text-balance">
            这篇讲的，做成工具给你用
          </h3>
          <p className="relative mx-auto mt-3 max-w-[44ch] text-[14px] leading-relaxed text-muted-foreground text-pretty">
            每个模块都有交付物清单与边界，先聊 30 分钟判断能不能做。
          </p>
          <div className="relative mt-6">
            <Button asChild size="lg" className="gap-2 shadow-glow">
              <Link to="/contact/">
                预约一次演示
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </Container>
    </div>
  )
}

/** 极简行内渲染：粗体。 */
function renderInline(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
  )
}
