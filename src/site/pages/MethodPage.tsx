import { Link } from "react-router-dom"
import { ArrowRight, CheckCircle2, MinusCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useSiteData } from "@/site/admin/store"
import { Container } from "@/site/components/Layout"

/** 怎么交付：流程、合作方式、不承诺、边界、FAQ。（页头标题来自「二级页页面设置」） */
export function MethodPage() {
  const { method, faqGroups, pageSettings } = useSiteData()
  const { process, tiers, notpromise, boundaries } = method
  const ps = pageSettings.method
  const lead = ps.lead || method.lead

  return (
    <div className="px-6 py-14 md:px-8 md:py-20">
      <Container>
        {/* 页头 */}
        <div className="max-w-2xl">
          <h1 className="text-gradient text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold tracking-[-0.03em] text-balance">
            {ps.title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {lead}
          </p>
        </div>

        {/* 交付流程 */}
        <section data-preview-anchor="method-process" className="mt-16">
          <h2 className="text-gradient text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em]">
            {process.title}
          </h2>
          <div className="mt-8 space-y-3">
            {process.steps.map((s) => (
              <div key={s.duration} className="glass-card card-hover flex gap-5 rounded-xl p-5 md:p-6">
                <span className="num w-[7.5rem] shrink-0 text-[12.5px] text-muted-foreground">
                  {s.duration}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                    {s.desc}
                  </p>
                  <p className="mt-2.5 text-[13px] text-primary">
                    交付物 · {s.deliverable}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 三种合作方式 */}
        <section data-preview-anchor="method-tiers" className="mt-20">
          <h2 className="text-gradient text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em]">
            {tiers.title}
          </h2>
          <p className="mt-3 text-[15px] text-muted-foreground">{tiers.lead}</p>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {tiers.items.map((t, i) => (
              <Card key={t.name} className={`glass-card card-hover gap-0 py-0 ${i === 1 ? "border-primary/35 ring-accent" : ""}`}>
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <h3 className="text-[15px] font-semibold">{t.name}</h3>
                  {i === 1 && <Badge className="font-normal">主力</Badge>}
                </div>
                <div className="p-6">
                  <div className="num text-[clamp(1.3rem,2.4vw,1.7rem)] font-bold tracking-[-0.01em]">
                    {t.price}
                  </div>
                  <p className="mt-2 text-[13px] text-muted-foreground">{t.for}</p>
                  <ul className="mt-5 space-y-2.5">
                    {t.includes.map((inc) => (
                      <li key={inc} className="flex items-start gap-2.5">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span className="text-[13px] leading-relaxed">{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground text-pretty">
            报价按可验收交付物计算，不按人天；区间对外只给下限，实际报价随场景复杂度浮动。首批 2—3 家内测有深度折扣，换三样东西：真实使用数据、可公开案例与书面证言授权，写进协议。
          </p>
        </section>

        {/* 不承诺 + 边界 */}
        <section data-preview-anchor="method-boundaries" className="mt-20 grid gap-4 lg:grid-cols-2">
          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center gap-2">
              <MinusCircle className="size-4 text-muted-foreground" />
              <h3 className="text-[16px] font-semibold">{notpromise.title}</h3>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">{notpromise.lead}</p>
            <ul className="mt-6 space-y-3">
              {notpromise.items.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="text-[13.5px] leading-relaxed text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card rounded-2xl p-8">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              <h3 className="text-[16px] font-semibold">{boundaries.title}</h3>
            </div>
            <ul className="mt-6 space-y-3">
              {boundaries.items.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-[13.5px] leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section data-preview-anchor="faqGroups" className="mt-20">
          <h2 className="text-gradient text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em]">
            常见问题
          </h2>
          <div className="mt-8 space-y-10">
            {faqGroups.map((g) => (
              <div key={g.title}>
                <h3 className="text-[14px] font-semibold text-muted-foreground">{g.title}</h3>
                <Accordion type="single" collapsible className="mt-4">
                  {g.items.map((item) => (
                    <AccordionItem key={item.q} value={item.q}>
                      <AccordionTrigger className="text-left text-[14.5px] font-medium">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-[13.5px] leading-relaxed text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-20 text-center">
          <h2 className="text-gradient text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] text-balance">
            想先看它怎么跑起来
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground text-pretty">
            带一份脱敏合同或一段真实的服务流程来，我们直接在上面看能不能跑通。
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="gap-2">
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
