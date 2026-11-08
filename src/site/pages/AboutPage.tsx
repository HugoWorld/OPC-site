import { Link } from "react-router-dom"
import { ArrowRight, CheckCircle2, MinusCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSiteData } from "@/site/admin/store"
import { Container, Section } from "@/site/components/Layout"

/** 关于我：履历时间线、三条工作原则、能力边界。（页头标题来自「二级页页面设置」） */
export function AboutPage() {
  const { about, theme, pageSettings, hero } = useSiteData()
  // 关于我页与首页共用同一张 IP 头像：主题里填了自定义就优先用，否则回落到内置头像
  const avatar = theme.avatarUrl || hero.avatarUrl
  return (
    <div data-preview-anchor="about" className="px-6 py-14 md:px-8 md:py-20">
      <Container>
        <div className="max-w-2xl">
          <h1 className="text-gradient text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold tracking-[-0.03em] text-balance">
            {pageSettings.about.title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {about.lead}
          </p>
        </div>

        {/* 形象占位 + 自我介绍 */}
        <div className="mt-14 grid gap-10 md:grid-cols-[240px_1fr]">
          <div className="flex flex-col items-center gap-3">
            {avatar ? (
              <img
                src={avatar}
                alt={theme.avatarLetter || "HugoW 形象"}
                className="glass-card size-[150px] rounded-2xl object-cover"
              />
            ) : (
              <span className="glass-card grid size-[150px] place-items-center rounded-2xl text-[64px] font-bold text-primary/60">
                {theme.avatarLetter || `H`}
              </span>
            )}
            <p className="text-center text-[12px] text-muted-foreground">
              形象为本人卡通化处理，不使用真人照片。
            </p>
          </div>
          <div className="max-w-[60ch] space-y-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {about.intro.split("。").filter(Boolean).map((s, i, arr) => (
              <p key={i}>
                {s}
                {i < arr.length - 1 ? "。" : ""}
              </p>
            ))}
          </div>
        </div>

        {/* 履历时间线 */}
        <Section className="border-t border-border">
          <h2 className="text-gradient text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em]">
            {about.timeline.title}
          </h2>
          <div className="mt-10 space-y-0">
            {about.timeline.items.map((item, i) => (
              <div key={item.title} className="relative flex gap-6 pb-10 last:pb-0">
                {i < about.timeline.items.length - 1 && (
                  <span aria-hidden className="absolute top-3 left-[5px] h-full w-px bg-border" />
                )}
                <span className="mt-1 size-[11px] shrink-0 rounded-full bg-primary ring-4 ring-primary/15" />
                <div>
                  <div className="num text-[12px] text-muted-foreground">{item.period}</div>
                  <h3 className="mt-1 text-[15.5px] font-semibold">{item.title}</h3>
                  <p className="mt-2 max-w-[58ch] text-[14px] leading-relaxed text-muted-foreground text-pretty">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 三条工作原则 */}
        <Section className="border-t border-border">
          <h2 className="text-gradient text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em]">
            {about.beliefs.title}
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {about.beliefs.items.map((b, i) => (
              <Card key={b.title} className="glass-card card-hover gap-0 py-0">
                <div className="p-6">
                  <div className="seq">0{i + 1}</div>
                  <h3 className="mt-3 text-[15px] font-semibold">{b.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                    {b.desc}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* 能力边界 */}
        <Section className="border-t border-border">
          <div className="glass-card relative overflow-hidden rounded-2xl p-8 md:p-12">
            <div aria-hidden className="ambient pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative grid gap-10 md:grid-cols-[1fr_1fr]">
              <div>
                <h3 className="flex items-center gap-2 text-[clamp(1.4rem,2.6vw,1.8rem)] font-extrabold tracking-[-0.02em]">
                  <MinusCircle className="size-5 text-muted-foreground" />
                  {about.notpromise.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                  写清楚不做的部分，比写清楚能做的部分更重要。
                </p>
              </div>
              <ul className="space-y-3">
                {about.notpromise.items.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-[14px] leading-relaxed">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* 联系引导（玻璃 + 光斑） */}
        <div className="glass-card relative mt-6 overflow-hidden rounded-2xl px-8 py-10 text-center">
          <div aria-hidden className="ambient pointer-events-none absolute inset-0 opacity-70" />
          <h3 className="text-gradient relative text-[clamp(1.4rem,2.6vw,1.9rem)] font-extrabold tracking-[-0.02em] text-balance">
            想判断一件事能不能做
          </h3>
          <p className="relative mx-auto mt-3 max-w-[44ch] text-[14px] leading-relaxed text-muted-foreground text-pretty">
            带一份真实的资料来，先聊 30 分钟。合不合适，聊完就有数。
          </p>
          <div className="relative mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2 shadow-glow">
              <Link to="/contact/">
                预约一次演示
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Badge variant="outline" className="border-primary/30 bg-transparent px-3 py-1.5 text-[13px] text-foreground">
              微信 · 邮箱 · 电话均可
            </Badge>
          </div>
        </div>
      </Container>
    </div>
  )
}
