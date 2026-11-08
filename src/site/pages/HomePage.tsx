import {
  ArrowRight,
  ClipboardCheck,
  Github,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSiteData } from "@/site/admin/store"
import { CtaBand } from "@/site/components/Cta"
import { DemoSection } from "@/site/components/DemoSection"
import { ProductsSection } from "@/site/components/ProductsSection"
import { Reveal } from "@/site/components/Reveal"
import { Section, SectionHead } from "@/site/components/Layout"
import { SharesSection } from "@/site/components/SharesSection"
import { TestimonialsSection } from "@/site/components/TestimonialsSection"
import { WritingTopics } from "@/site/components/WritingTopics"
import { HOME_SECTIONS } from "@/site/data/home"

/**
 * 首页：按游客兴趣动线重排——
 * 人设（头像/标签/GitHub）→ 数字条 → 我的产品（自动轮播）→ 产品与演示 →
 * 分享区 → 为什么找我 → 怎么交付 → 大家评价 → 按主题找文章 → 联系一下。
 */
export function HomePage() {
  const { hero, stats, valueProps, homeSections, theme } = useSiteData()
  /** 按 key 取区块标题（防御旧版 homeSections 顺序错位） */
  const sec = (key: string) =>
    homeSections.find((s) => s.key === key) ?? HOME_SECTIONS.find((s) => s.key === key) ?? HOME_SECTIONS[0]

  const avatarUrl = theme.avatarUrl || hero.avatarUrl
  const heroBg = hero.heroBgUrl

  return (
    <>
      {/* ---------------- Hero：人设区（先记住人，再了解产品） ---------------- */}
      <section
        data-preview-anchor="hero"
        className="relative overflow-hidden px-6 pt-14 pb-10 md:px-8 md:pt-20"
      >
        <div aria-hidden className="grid-bg grid-mask pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid w-full max-w-[1120px] items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
          {/* 左：定位 + 一句话 + 标签 + 动作 */}
          <div>
            <Badge
              variant="outline"
              className="animate-fade-in glass-card mb-6 gap-1.5 border-primary/30 px-3 py-1 text-primary"
            >
              <Sparkles className="size-3" />
              {hero.eyebrow}
            </Badge>

            <h1 className="animate-fade-up text-gradient text-[clamp(2.2rem,5.2vw,3.6rem)] leading-[1.1] font-extrabold tracking-[-0.03em] text-balance">
              {hero.title}
            </h1>

            <p className="animate-fade-up mt-6 max-w-[48ch] text-[15px] leading-relaxed text-muted-foreground [animation-delay:80ms] text-pretty">
              {hero.lead}
            </p>
            <p className="animate-fade-up mt-4 max-w-[48ch] text-[13px] leading-relaxed text-muted-foreground/80 [animation-delay:120ms] text-pretty">
              {hero.note}
            </p>

            {/* 个人标签：让游客一下记住这个人 */}
            {hero.tags?.length ? (
              <div className="animate-fade-up mt-6 flex flex-wrap gap-2 [animation-delay:150ms]">
                {hero.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-[12.5px] font-semibold text-primary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="animate-fade-up mt-9 flex flex-wrap items-center gap-3 [animation-delay:190ms]">
              <Button asChild size="lg" className="gap-2 shadow-glow">
                <a
                  href="#/"
                  onClick={(e) => {
                    // HashRouter 下不能用 #anchor，改为平滑滚动到产品区
                    e.preventDefault()
                    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })
                  }}
                >
                  看看我在做什么
                  <ArrowRight className="size-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <a
                  href={hero.githubUrl || "https://github.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="size-4" />
                  {hero.githubLabel || "GitHub"}
                </a>
              </Button>
            </div>
          </div>

          {/* 右：卡通拟人化头像区（背景图可自定义） */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <div className="glass-card relative mx-auto max-w-md overflow-hidden rounded-3xl p-8 text-center shadow-lift">
              {heroBg ? (
                <img
                  src={heroBg}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 size-full scale-105 object-cover opacity-40 blur-[3px]"
                />
              ) : (
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary/12 via-accent to-accent2/15" />
              )}
              <div aria-hidden className="ambient pointer-events-none absolute inset-0 opacity-60" />
              {/* 中心提亮：把头像从背景插画里托出来，避免背景色块压在人脸边上 */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.86),rgba(255,255,255,0.35)_45%,transparent_68%)]"
              />

              <div className="relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="HugoW 拟卡通形象"
                    className="mx-auto size-40 rounded-full border-[3px] border-card/85 object-cover shadow-glow md:size-56"
                  />
                ) : (
                  <div className="mx-auto grid size-40 place-items-center rounded-full border-[3px] border-card/85 bg-gradient-to-br from-primary to-accent2 text-[64px] font-extrabold text-white shadow-glow md:size-56">
                    {theme.avatarLetter || "H"}
                  </div>
                )}

                {hero.bubble ? (
                  <div className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-card/85 px-4 py-2 text-[14px] font-semibold text-foreground shadow-sm backdrop-blur">
                    <Sparkles className="size-4 text-primary" />
                    {hero.bubble}
                  </div>
                ) : null}

                <p className="mt-4 text-[13px] text-muted-foreground">{hero.eyebrow}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 数字条（信任数据卡，紧随人设） ---------------- */}
      <section data-preview-anchor="stats" className="px-6 pb-2 md:px-8">
        <div className="mx-auto w-full max-w-[1120px]">
          <Reveal>
            <div className="glass-card grid grid-cols-2 gap-x-6 gap-y-8 rounded-2xl px-7 py-8 md:grid-cols-4 md:px-9">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <div className="num text-gradient text-[clamp(1.9rem,4vw,2.6rem)] font-bold tracking-[-0.02em]">
                    {s.value}
                  </div>
                  <div className="mt-1 text-[14px] font-medium">{s.label}</div>
                  <div className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{s.note}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- 01 我的产品（卡片轮播，居中放大） ---------------- */}
      <Section id="products" anchor="products">
        <Reveal>
          <SectionHead num={sec("products").num} title={sec("products").title} lead={sec("products").lead} />
        </Reveal>
        <Reveal delay={60}>
          <ProductsSection />
        </Reveal>
      </Section>

      {/* ---------------- 02 产品与演示（产品列 + 大视频） ---------------- */}
      <Section id="demos" anchor="demos">
        <Reveal>
          <SectionHead num={sec("demo").num} title={sec("demo").title} lead={sec("demo").lead} />
        </Reveal>
        <Reveal delay={60}>
          <DemoSection />
        </Reveal>
      </Section>

      {/* ---------------- 04 分享区 ---------------- */}
      <Section id="shares" anchor="shares">
        <Reveal>
          <SectionHead num={sec("shares").num} title={sec("shares").title} lead={sec("shares").lead} />
        </Reveal>
        <Reveal delay={60}>
          <SharesSection />
        </Reveal>
      </Section>

      {/* ---------------- 05 你为什么该找我 ---------------- */}
      <Section id="value-props" anchor="valueProps">
        <Reveal>
          <SectionHead
            num={sec("value_props").num}
            title={sec("value_props").title}
            lead={sec("value_props").lead}
          />
        </Reveal>
        {/* 编号理由列表：紧凑呈现「为什么该找我」的 5 条具体理由（不用大卡） */}
        <div className="glass-card mt-10 overflow-hidden rounded-2xl">
          <div className="divide-y divide-border/60">
            {valueProps.map((p, i) => (
              <Reveal key={p.title} delay={i * 50}>
                <div className="group flex items-start gap-4 px-6 py-5 transition-colors hover:bg-muted/40 md:gap-6 md:px-8">
                  <span className="mt-0.5 shrink-0 font-mono text-[15px] font-bold text-primary/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold">{p.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                      {p.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* ---------------- 06 怎么交付 ---------------- */}
      <Section id="method" anchor="method">
        <Reveal>
          <SectionHead
            num={sec("method").num}
            title={sec("method").title}
            lead={sec("method").lead}
            more={sec("method").more}
          />
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "先对齐交付边界",
              d: "写不进合同的不承诺。边界写在最前面，后面才不会有分歧。",
              icon: ShieldCheck,
            },
            {
              n: "02",
              t: "做出能验收的东西",
              d: "两周内用真实素材跑出第一版，交付物清单逐项可查。",
              icon: ClipboardCheck,
            },
            {
              n: "03",
              t: "固化成流水线",
              d: "能被复现、能被接手的才叫交付。规则入库，团队不再靠人肉。",
              icon: Workflow,
            },
          ].map(({ n, t, d, icon: Icon }, i) => (
            <Reveal key={n} delay={i * 70}>
              <div className="group glass-card card-hover relative h-full overflow-hidden rounded-2xl p-6">
                <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
                <div
                  aria-hidden
                  className="ambient pointer-events-none absolute -right-12 -top-12 size-36 opacity-40 transition-opacity duration-500 group-hover:opacity-70"
                />
                <div className="relative flex items-start justify-between gap-3">
                  <span className="text-gradient text-[clamp(2rem,4vw,2.5rem)] font-extrabold leading-none tracking-[-0.02em]">
                    {n}
                  </span>
                  <span className="grid size-10 place-items-center rounded-xl border border-primary/20 bg-accent text-accent-foreground shadow-[0_0_18px_-4px_var(--brand-accent)]">
                    <Icon className="size-4.5" />
                  </span>
                </div>
                <h3 className="mt-5 text-[17.5px] font-bold tracking-[-0.01em]">{t}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-muted-foreground text-pretty">
                  {d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------- 07 证据 ---------------- */}
      <Section id="evidence" anchor="evidence">
        <Reveal>
          <SectionHead
            num={sec("evidence").num}
            title={sec("evidence").title}
            lead={sec("evidence").lead}
            more={sec("evidence").more}
          />
        </Reveal>
        <Reveal delay={60}>
          <TestimonialsSection />
        </Reveal>
      </Section>

      {/* ---------------- 07 按主题找文章 ---------------- */}
      <Section id="writing" anchor="writing">
        <Reveal>
          <SectionHead
            num={sec("writing").num}
            title={sec("writing").title}
            lead={sec("writing").lead}
            more={sec("writing").more}
          />
        </Reveal>
        <Reveal delay={60}>
          <WritingTopics />
        </Reveal>
      </Section>

      {/* ---------------- 收尾 CTA ---------------- */}
      <CtaBand />
    </>
  )
}
