/* ------------------------------------------------------------------ */
/* 草稿数据 → 12 张 Base 表的行映射。                                    */
/*                                                                    */
/* 只做「切片 → 行」的组装，不负责单元格编码；发布服务统一调用           */
/* encodeRecord()，保证 multiline / json / bool / number 的形态一致。    */
/*                                                                    */
/* 注意三个已知的字段错位（必须在这里显式转换）：                        */
/*   theme.avatarLetter      → theme.letter                             */
/*   products.demoVideoId    → 表里没有列（有意丢弃）                    */
/*   shares.topic            → shares.group                             */
/* ------------------------------------------------------------------ */

import type { TableRecord } from "../site/admin/data/table-schema.ts"

type Obj = Record<string, unknown>

function asObj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function bool(value: unknown): boolean {
  return value !== false
}

/** 首页 8 个 blocks 的固定 id 与类型（顺序即 order）。 */
export function buildHomeBlockRows(draft: Obj): TableRecord[] {
  const hero = asObj(draft.hero)
  const stats = asArray(draft.stats)
  const valueProps = asArray(draft.valueProps)
  const audiences = asArray(draft.audiences)
  const homeSections = asArray(draft.homeSections)
  const demos = asArray(draft.demos)
  const demoVideos = asArray(draft.demoVideos)
  const productCarousel = asObj(draft.productCarousel)

  return [
    {
      id: "hero",
      type: "hero",
      title: str(hero.title),
      eyebrow: str(hero.eyebrow),
      lead: str(hero.lead),
      note: str(hero.note),
      items: hero,
      order: 1,
    },
    {
      id: "stats",
      type: "stats",
      title: "关键数字",
      items: stats,
      order: 2,
    },
    {
      id: "value-props",
      type: "cards",
      title: "价值主张",
      items: valueProps,
      order: 3,
    },
    {
      id: "audiences",
      type: "cards",
      title: "适合谁",
      items: audiences,
      order: 4,
    },
    {
      id: "home-sections",
      type: "sections",
      title: "首页区块编排",
      items: homeSections,
      order: 5,
    },
    {
      id: "demos",
      type: "demos",
      title: "演示面板",
      items: demos,
      order: 6,
    },
    {
      id: "demo-videos",
      type: "videos",
      title: "产品演示视频",
      items: demoVideos,
      order: 7,
    },
    {
      id: "product-carousel",
      type: "carousel",
      title: "产品轮播设置",
      items: productCarousel,
      order: 8,
    },
  ]
}

function readMinutes(body: unknown): number {
  const paragraphs = asArray(body).map((p) => String(p))
  const chars = paragraphs.join("").length
  return Math.max(1, Math.ceil(chars / 320))
}

function sampleRows(draft: Obj): TableRecord[] {
  const samples = asArray(draft.samples)
  const testimonials = asArray(draft.testimonials)
  const rows: TableRecord[] = []
  samples.forEach((raw, index) => {
    const s = asObj(raw)
    rows.push({
      id: `sample-${String(index + 1).padStart(2, "0")}`,
      kind: "sample",
      title: str(s.title),
      desc: str(s.note),
      order: index + 1,
      published: true,
    })
  })
  testimonials.forEach((raw, index) => {
    const t = asObj(raw)
    rows.push({
      id: str(t.id) || `testimonial-${String(index + 1).padStart(2, "0")}`,
      kind: "testimonial",
      quote: str(t.quote),
      name: str(t.author),
      role: str(t.role),
      project: str(t.project),
      order: num(t.order, index + 1),
      published: bool(t.published),
    })
  })
  return rows
}

/**
 * 组装 11 张业务表的行（audit_log 由发布服务单独追加）。
 * 返回的 rows 仍是「源值」形态，不是单元格值。
 */
export function buildTableRows(draft: Obj): Record<string, TableRecord[]> {
  const site = asObj(draft.site)
  const theme = asObj(draft.theme)
  const method = asObj(draft.method)
  const about = asObj(draft.about)
  const pages = asArray(draft.pages)
  const products = asArray(draft.products)
  const shares = asArray(draft.shares)
  const articles = asArray(draft.articles)
  const solutions = asArray(draft.solutions)

  const pagesRows = pages.map((raw) => {
    const p = asObj(raw)
    return {
      slug: str(p.slug),
      title: str(p.title),
      inNav: p.inNav === true,
      origin: str(p.origin, "custom"),
      blocksJson: asArray(p.blocks),
    }
  })

  return {
    site_config: [
      {
        brandName: str(site.brandName),
        brandShort: str(site.brandShort),
        tagline: str(site.tagline),
        locale: str(site.locale),
        author: str(site.author),
        company: str(site.company),
        icoNote: str(site.icoNote),
        mascotAlt: str(site.mascotAlt),
        email: str(site.email),
        emailHref: str(site.emailHref),
        wechatNote: str(site.wechatNote),
        responseTime: str(site.responseTime),
        demoDuration: str(site.demoDuration),
        nav: draft.nav ?? [],
        cta: draft.cta ?? {},
        footerColumns: draft.footerColumns ?? [],
        footerBoundary: str(draft.footerBoundary),
        footerAigc: str(draft.footerAigc),
        pageSettings: draft.pageSettings ?? {},
        contact: draft.contact ?? {},
      },
    ],
    home_blocks: buildHomeBlockRows(draft),
    solutions: solutions.map((raw, index) => {
      const s = asObj(raw)
      const demo = asObj(s.demo)
      return {
        id: str(s.id),
        tier: str(s.tier, "引流"),
        title: str(s.title),
        subtitle: str(s.subtitle),
        audience: str(s.audience),
        problem: str(s.problem),
        capabilities: asArray(s.capabilities),
        deliverables: asArray(s.deliverables),
        boundaries: asArray(s.boundaries),
        stack: asArray(s.stack),
        demoStatus: str(demo.status, "待建"),
        demoDuration: str(demo.duration),
        demoNote: str(demo.note),
        order: num(s.order, index + 1),
        published: bool(s.published),
        body: s.body ?? [],
        proof: s.proof ?? [],
      }
    }),
    articles: articles.map((raw) => {
      const a = asObj(raw)
      return {
        slug: str(a.slug),
        title: str(a.title),
        category: str(a.category),
        date: str(a.date),
        summary: str(a.summary),
        takeaway: str(a.takeaway),
        tags: asArray(a.tags),
        modules: asArray(a.modules),
        status: str(a.status, "draft"),
        body: a.body ?? [],
        readMinutes: readMinutes(a.body),
      }
    }),
    products: products.map((raw) => {
      const p = asObj(raw)
      return {
        id: str(p.id),
        name: str(p.name),
        intro: str(p.intro),
        category: str(p.category),
        tags: asArray(p.tags),
        coverUrl: str(p.coverUrl),
        link: str(p.link),
        order: num(p.order),
        published: bool(p.published),
      }
    }),
    shares: shares.map((raw) => {
      const s = asObj(raw)
      return {
        id: str(s.id),
        title: str(s.title),
        desc: str(s.note),
        url: str(s.url),
        group: str(s.topic),
        kind: str(s.kind),
        author: str(s.author),
        order: num(s.order),
        published: bool(s.published),
      }
    }),
    pages: pagesRows,
    method_faq: [
      {
        id: "method",
        steps: asObj(method.process),
        pricing: asObj(method.tiers),
        noPromise: asObj(method.notpromise),
        boundaries: asObj(method.boundaries),
        faq: draft.faqGroups ?? [],
      },
    ],
    about: [
      {
        id: "about",
        lead: str(about.lead),
        intro: str(about.intro),
        timeline: asObj(about.timeline),
        principles: asObj(about.beliefs),
        boundaries: asObj(about.notpromise),
      },
    ],
    theme: [
      {
        id: "theme",
        accent: str(theme.accent, "#ff5d01"),
        accent2: str(theme.accent2, "#8b5cf6"),
        density: str(theme.density, "normal"),
        avatarUrl: str(theme.avatarUrl),
        letter: str(theme.avatarLetter, "H"),
        homePageSlug: str(theme.homePageSlug),
      },
    ],
    samples_testimonials: sampleRows(draft),
  }
}
