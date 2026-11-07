import { Link, useParams } from "react-router-dom"
import { ArrowRight, CheckCircle2, ChevronDown, Clock, Sparkles } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useSiteData } from "@/site/admin/store"
import { Container, Section, SectionHead } from "@/site/components/Layout"
import type { CustomPage, PageBlock } from "@/site/data/pages"

/* ------------------------------------------------------------------ */
/* 通用化：动态页面渲染器。                                             */
/* 按页面注册表（store.pages）中的 slug 找到 CustomPage，               */
/* 依序渲染每个区块（type 决定组件形态）。每个区块带 data-preview-anchor  */
/* （= 区块 id），工作台编辑该区块时可定位高亮。                          */
/* ------------------------------------------------------------------ */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="glass-card rounded-xl transition-colors">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-[14.5px] font-semibold">{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="border-t border-border/70 px-5 py-4 text-[13.5px] leading-relaxed text-muted-foreground">
          {a}
        </p>
      )}
    </div>
  )
}

/** 渲染单个区块。
 *  hero 区块承担页面的主标题：仅当它是第一个区块时用 h1，
 *  否则降为 h2 —— 保证每个路由页面只有一个 h1（多 hero 页不会重复）。 */
function BlockRenderer({ block, first }: { block: PageBlock; first?: boolean }) {
  const HeroHeading = (first ? "h1" : "h2") as "h1" | "h2"
  switch (block.type) {
    case "hero":
      return (
        <Section anchor={block.id} className="!pt-16 !pb-10 md:!pt-20">
          <div className="max-w-3xl">
            {block.eyebrow && (
              <Badge
                variant="outline"
                className="mb-5 gap-1.5 glass-card border-primary/30 px-3 py-1 text-primary"
              >
                <Sparkles className="size-3" />
                {block.eyebrow}
              </Badge>
            )}
            <HeroHeading className="text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.12] font-extrabold tracking-[-0.03em] text-balance">
              {block.title}
            </HeroHeading>
            <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground text-pretty">
              {block.lead}
            </p>
            {block.note && (
              <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground/80 text-pretty">
                {block.note}
              </p>
            )}
            {(block.ctaText || block.ctaHref) && (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="gap-2">
                  <Link to={block.ctaHref || "/contact/"}>
                    {block.ctaText || "联系我"}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </Section>
      )

    case "stats":
      return (
        <Section anchor={block.id}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {block.items.map((s, i) => (
              <div key={i} className="glass-card rounded-xl p-5">
                <div className="num text-[clamp(1.9rem,3.6vw,2.6rem)] font-extrabold">{s.value}</div>
                <div className="mt-1 text-[14px] font-medium">{s.label}</div>
                {s.note && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{s.note}</div>}
              </div>
            ))}
          </div>
        </Section>
      )

    case "cards":
      return (
        <Section anchor={block.id}>
          {block.title && <SectionHead title={block.title} lead={block.subtitle} />}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {block.items.map((c, i) => {
              const inner = (
                <div className="flex h-full flex-col glass-card rounded-xl p-5 card-hover transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[15px] font-bold">{c.title}</div>
                    {c.tag && <Badge>{c.tag}</Badge>}
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.desc}</p>
                  {c.href && (
                    <span className="mt-auto pt-4 text-[12.5px] font-medium text-primary">
                      查看详情 →
                    </span>
                  )}
                </div>
              )
              return c.href ? (
                <Link key={i} to={c.href} className="block">
                  {inner}
                </Link>
              ) : (
                <div key={i}>{inner}</div>
              )
            })}
          </div>
        </Section>
      )

    case "text":
      return (
        <Section anchor={block.id}>
          {block.title && <SectionHead title={block.title} />}
          <div className="mt-6 max-w-[72ch] space-y-4">
            {block.body.split(/\n\s*\n/).map((p, i) => (
              <p key={i} className="text-[14.5px] leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>
        </Section>
      )

    case "faq":
      return (
        <Section anchor={block.id}>
          {block.title && <SectionHead title={block.title} />}
          <div className="mt-8 space-y-2.5">
            {block.groups.map((g, i) => (
              <FaqItem key={i} q={g.question} a={g.answer} />
            ))}
          </div>
        </Section>
      )

    case "timeline":
      return (
        <Section anchor={block.id}>
          {block.title && <SectionHead title={block.title} />}
          <ol className="mt-8 space-y-0">
            {block.items.map((t, i) => (
              <li key={i} className="relative flex gap-5 pb-8 last:pb-0">
                {i < block.items.length - 1 && (
                  <span aria-hidden className="absolute top-7 left-[11px] h-full w-px bg-border" />
                )}
                <span
                  aria-hidden
                  className="mt-1 grid size-[23px] shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/5"
                >
                  <span className="size-1.5 rounded-full bg-primary" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-primary">{t.time}</span>
                    <span className="text-[15px] font-bold">{t.title}</span>
                  </div>
                  {t.desc && (
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{t.desc}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )

    case "cta":
      return (
        <Section anchor={block.id}>
          <div className="glass-card relative overflow-hidden rounded-2xl px-6 py-12 text-center md:px-12">
            <div aria-hidden className="ambient pointer-events-none absolute inset-0 opacity-60" />
            <h2 className="text-gradient relative text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] text-balance">
              {block.title}
            </h2>
            {block.subtitle && (
              <p className="relative mx-auto mt-3 max-w-[46ch] text-[14px] text-muted-foreground">
                {block.subtitle}
              </p>
            )}
            {(block.buttonText || block.buttonHref) && (
              <div className="relative mt-7 flex justify-center">
                <Button asChild size="lg" className="gap-2">
                  <Link to={block.buttonHref || "/contact/"}>
                    <CheckCircle2 className="size-4" />
                    {block.buttonText || "联系我"}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </Section>
      )

    case "columns":
      return (
        <Section anchor={block.id}>
          {block.title && <SectionHead title={block.title} />}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {block.columns.map((c, i) => (
              <div key={i} className="glass-card rounded-xl p-5">
                <div className="seq mb-3 text-[13px]" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-[15px] font-bold">{c.title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </Section>
      )

    case "gallery":
      return (
        <Section anchor={block.id}>
          {block.title && <SectionHead title={block.title} />}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {block.items.map((g, i) => (
              <div
                key={i}
                className="group overflow-hidden glass-card rounded-xl"
              >
                <div className="grid h-36 place-items-center bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
                  <Clock className="size-7 text-primary/40" />
                </div>
                <div className="p-4">
                  <div className="text-[14px] font-bold">{g.title}</div>
                  {g.desc && (
                    <p className="mt-1 text-[12.5px] text-muted-foreground">{g.desc}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )

    case "pricing":
      return (
        <Section anchor={block.id}>
          {block.title && <SectionHead title={block.title} lead={block.subtitle} />}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {block.plans.map((p, i) => (
              <div
                key={i}
                className={`relative flex flex-col rounded-xl p-5 ${
                  p.featured
                    ? "glass-card border-primary/40 ring-accent"
                    : "glass-card"
                }`}
              >
                {p.featured && (
                  <Badge className="absolute -top-2.5 right-4">推荐</Badge>
                )}
                <div className="text-[14px] font-semibold">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[clamp(1.6rem,3vw,2.1rem)] font-extrabold tracking-tight">
                    {p.price}
                  </span>
                  {p.period && (
                    <span className="text-[12px] text-muted-foreground">{p.period}</span>
                  )}
                </div>
                {p.desc && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{p.desc}</p>
                )}
                <ul className="mt-4 space-y-1.5">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-[13px]">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                {(p.ctaText || p.ctaHref) && (
                  <div className="mt-5 pt-2">
                    <Button asChild size="sm" variant={p.featured ? "default" : "outline"} className="w-full">
                      <Link to={p.ctaHref || "/contact/"}>{p.ctaText || "联系我"}</Link>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )

    case "testimonials":
      return (
        <Section anchor={block.id}>
          {block.title && <SectionHead title={block.title} lead={block.subtitle} />}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {block.items.map((t, i) => (
              <figure key={i} className="glass-card rounded-xl p-5">
                <blockquote className="text-[13.5px] leading-relaxed text-foreground/90">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">
                    {t.name.slice(0, 1)}
                  </span>
                  <div>
                    <div className="text-[12.5px] font-semibold">{t.name}</div>
                    {t.role && (
                      <div className="text-[11.5px] text-muted-foreground">{t.role}</div>
                    )}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )
  }
}

/**
 * 动态页面渲染主体（可复用）：
 * - DynamicPage：/pages/:slug/ 路由使用（pathNote 显示页面路径）
 * - HomeRoute：首页换肤映射使用（pathNote 显示「首页模板 · 已映射到 /」）
 */
export function DynamicPageView({ page, pathNote }: { page: CustomPage; pathNote?: string }) {
  // 首个区块是 hero 时由它承担 h1，页面标题降为 h2，保证每页只有一个 h1
  const heroFirst = page.blocks[0]?.type === "hero"
  const PageHeading = (heroFirst ? "h2" : "h1") as "h1" | "h2"
  return (
    <div>
      <div className="border-b border-border/60 bg-muted/30">
        <Container className="py-6 md:py-8">
          <div className="text-[12.5px] text-muted-foreground">
            {pathNote ?? `自定义页面 · /pages/${page.slug}/`}
          </div>
          <PageHeading className="mt-1 text-[clamp(1.4rem,3vw,2rem)] font-extrabold tracking-[-0.02em]">
            {page.title}
          </PageHeading>
        </Container>
      </div>
      {page.blocks.map((b, i) => (
        <BlockRenderer key={b.id} block={b} first={i === 0} />
      ))}
    </div>
  )
}

/** 动态页面：/pages/:slug/ */
export function DynamicPage() {
  const { slug = "" } = useParams()
  const { pages } = useSiteData()
  const page = pages.find((p) => p.slug === slug)

  if (!page) {
    return (
      <Container className="py-24 text-center">
        <h1 className="text-[22px] font-bold">页面不存在</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          该自定义页面未找到，可能已删除或未发布。
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">返回首页</Link>
        </Button>
      </Container>
    )
  }

  return <DynamicPageView page={page} />
}
