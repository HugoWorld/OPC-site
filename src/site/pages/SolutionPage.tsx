import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileCheck2, MinusCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useSiteData } from "@/site/admin/store"
import { Container } from "@/site/components/Layout"
import { TIER_STYLE } from "@/site/data/solutions"
import { NotFoundPage } from "@/site/pages/NotFoundPage"

/** 单个能力模块详情页。 */
export function SolutionPage() {
  const { id } = useParams<{ id: string }>()
  const { solutions } = useSiteData()
  const s = id ? solutions.find((x) => x.id === id) : undefined

  if (!s) return <NotFoundPage />

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
          <Badge variant={TIER_STYLE[s.tier] as "default" | "secondary" | "outline"} className="font-normal">
            {s.tier}
          </Badge>
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

        {/* 交付物 + 边界 */}
        <section className="mt-14 grid gap-4 md:grid-cols-2">
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

          <Card className="glass-card gap-0 py-0">
            <div className="flex items-center gap-2 border-b border-border px-6 py-4">
              <MinusCircle className="size-4 text-muted-foreground" />
              <h3 className="text-[15px] font-semibold">边界（不做什么）</h3>
            </div>
            <ul className="space-y-3 p-6">
              {s.boundaries.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="text-[14px] leading-relaxed text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* 技术栈 */}
        <section className="mt-10">
          <h3 className="text-[13px] font-semibold text-muted-foreground">技术栈</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.stack.map((t) => (
              <Badge key={t} variant="outline" className="font-mono font-normal">
                {t}
              </Badge>
            ))}
          </div>
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

        {/* 模块底部边界声明（模板自动插入） */}
        <Separator className="mt-16" />
        <p className="mt-6 max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground text-pretty">
          本模块交付工具与流水线，最终产出由你方人员复核确认。我不承诺流量、搜索排名、线索数量或模型输出准确率。
        </p>
      </Container>
    </div>
  )
}
