import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileCheck2, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSiteData } from "@/site/admin/store"
import { Container } from "@/site/components/Layout"
import { SOLUTION_OUTCOME_FALLBACK } from "@/site/data/solutions"
import { NotFoundPage } from "@/site/pages/NotFoundPage"

/** 单个能力模块详情页。 */
export function SolutionPage() {
  const { id } = useParams<{ id: string }>()
  const { solutions } = useSiteData()
  const s = id ? solutions.find((x) => x.id === id) : undefined

  if (!s) return <NotFoundPage />
  const outcomes = s.outcomes ?? SOLUTION_OUTCOME_FALLBACK[s.id] ?? []

  return (
    <div className="px-6 py-14 md:px-8 md:py-20">
      <Container>
        {/* 面包屑 */}
        <Link
          to="/solutions/"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          全部模块
        </Link>

        {/* 头部 */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted-foreground">适用 · {s.audience}</span>
        </div>
        <h1 className="text-gradient mt-4 text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold tracking-[-0.03em] text-balance">
          {s.title}
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted-foreground text-pretty">
          {s.subtitle}
        </p>

        {/* 演示信息条 */}
        <div className="glass-card mt-8 flex flex-wrap items-center gap-4 rounded-xl px-5 py-4">
          <span className="flex items-center gap-2 text-[14px]">
            <Clock className="size-4 text-primary" />
            <Badge variant={s.demo.status === "可演示" ? "default" : "secondary"} className="font-normal">
              {s.demo.status}
            </Badge>
            <span className="text-muted-foreground">{s.demo.duration}</span>
          </span>
          <span className="text-[13px] text-muted-foreground">{s.demo.note}</span>
          <div className="ml-auto">
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/contact/">
                约一次演示
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* 问题 */}
        <section className="mt-14 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-gradient text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em]">
              它解决的是这个问题
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
              {s.problem}
            </p>
          </div>
          <Card className="glass-card gap-0 py-0">
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-[15px] font-semibold">能做什么</h3>
            </div>
            <ul className="divide-y divide-border">
              {s.capabilities.map((c) => (
                <li key={c} className="flex items-start gap-3 px-6 py-4">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-[14px] leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* 交付物 + 用起来之后 */}
        <section className={`mt-14 grid gap-4 ${outcomes.length > 0 ? "md:grid-cols-2" : ""}`}>
          <Card className="glass-card gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border px-6 py-4">
              <FileCheck2 className="size-4 text-primary" />
              <h3 className="text-[15px] font-semibold">你拿到手的东西</h3>
            </div>
            <ul className="space-y-3 p-6">
              {s.deliverables.map((d) => (
                <li key={d} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-[14px] leading-relaxed">{d}</span>
                </li>
              ))}
            </ul>
          </Card>

          {outcomes.length > 0 && (
            <Card className="glass-card gap-0 py-0">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-[15px] font-semibold">用起来之后</h3>
              </div>
              <ul className="space-y-3 p-6">
                {outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-[14px] leading-relaxed">{o}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        {/* 正文 */}
        {s.body.length > 0 && (
          <section className="mt-14 space-y-10">
            {s.body.map((block) => (
              <div key={block.heading}>
                <h2 className="text-gradient text-[clamp(1.3rem,2.4vw,1.7rem)] font-bold tracking-[-0.02em]">
                  {block.heading}
                </h2>
                {block.paragraphs.map((p, i) => (
                  <p key={i} className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-muted-foreground text-pretty">
                    {p}
                  </p>
                ))}
                {block.table && (
                  <div className="glass-card mt-5 overflow-x-auto rounded-xl">
                    <table className="w-full min-w-[560px] text-left text-[13.5px]">
                      <thead className="bg-muted/60">
                        <tr>
                          {block.table[0].map((h) => (
                            <th key={h} className="px-4 py-3 font-medium text-muted-foreground">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {block.table.slice(1).map((row, ri) => (
                          <tr key={ri}>
                            {row.map((c, ci) => (
                              <td key={ci} className="px-4 py-3">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </Container>
    </div>
  )
}
