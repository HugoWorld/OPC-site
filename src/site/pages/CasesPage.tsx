import { Link } from "react-router-dom"
import { ArrowRight, FileText } from "lucide-react"

import { Card } from "@/components/ui/card"
import { useSiteData } from "@/site/admin/store"
import { ArticleCard } from "@/site/components/ArticleCard"
import { Container } from "@/site/components/Layout"

/** 大家评价：案例复盘 + 交付物样例（页头与首页「大家评价」一致；标题/导语来自工作台「二级页页面设置」）。 */
export function CasesPage() {
  const { articles, samples, pageSettings } = useSiteData()
  const published = articles.filter((a) => a.status === "published")
  const cases = published.filter((a) => a.category === "case")
  const ps = pageSettings.cases

  return (
    <div data-preview-anchor="evidence" className="px-6 py-14 md:px-8 md:py-20">
      <Container>
        <div className="max-w-2xl">
          <h1 className="text-gradient text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold tracking-[-0.03em] text-balance">
            {ps.title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {ps.lead}
          </p>
        </div>

        {/* 案例复盘 */}
        <section data-preview-anchor="samples" className="mt-16">
          <h2 className="text-gradient text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em]">
            案例复盘
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {cases.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </section>

        {/* 交付物样例 */}
        <section className="mt-20">
          <h2 className="text-gradient text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em]">
            交付物样例
          </h2>
          <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-muted-foreground text-pretty">
            以下是从真实交付中沉淀的产物形态（脱敏）。拿到手的东西长什么样，这里直接给你看。
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {samples.map((s) => (
              <Card key={s.title} className="glass-card card-hover gap-0 py-0">
                <div className="p-6">
                  <span className="mb-4 grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <FileText className="size-4.5" />
                  </span>
                  <h3 className="text-[15px] font-semibold">{s.title}</h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                    {s.note}
                  </p>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground text-pretty">
            还没有公开的真实客户案例之前，样例页不编造数字与客户名。想判断「像不像你们」，带一份脱敏资料来现场跑一次最直接。
          </p>
          <div className="mt-8">
            <Link
              to="/contact/"
              className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-primary transition-colors hover:text-primary/80"
            >
              拿同类案例 · 约一次演示
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </Container>
    </div>
  )
}
