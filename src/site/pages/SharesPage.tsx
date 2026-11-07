import { useMemo } from "react"
import { ArrowUpRight, Github, Newspaper, Wrench } from "lucide-react"

import { useSiteData } from "@/site/admin/store"
import { Container } from "@/site/components/Layout"
import { SHARE_KIND_LABELS, SHARES_SORTED, type Share, type ShareKind } from "@/site/data/shares"

const KIND_ICON: Record<ShareKind, typeof Github> = {
  github: Github,
  article: Newspaper,
  tool: Wrench,
}

const KIND_ORDER: ShareKind[] = ["github", "article", "tool"]

/** 分享全览：首页「分享区」的「查看更多」落地页——全部条目按类型分组展示（卡片样式与首页保持一致；页头来自「二级页页面设置」）。 */
export function SharesPage() {
  const { shares, pageSettings } = useSiteData()
  const ps = pageSettings.shares
  const list = useMemo(
    () =>
      (shares.length > 0 ? [...shares] : SHARES_SORTED)
        .filter((s) => s.published !== false)
        .sort((a, b) => a.order - b.order),
    [shares]
  )

  return (
    <div data-preview-anchor="shares" className="px-6 py-14 md:px-8 md:py-20">
      <Container>
        <div className="max-w-2xl">
          <h1 className="text-gradient text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold tracking-[-0.03em] text-balance">
            {ps.title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {ps.lead}
          </p>
        </div>

        {list.length === 0 ? (
          <div className="glass-card mt-10 rounded-2xl px-6 py-12 text-center">
            <p className="text-[14px] font-medium">还没有分享内容</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              到工作台「分享管理」添加 GitHub 项目 / 博主文章 / 好工具。
            </p>
          </div>
        ) : (
          KIND_ORDER.map((kind) => {
            const group = list.filter((s) => s.kind === kind)
            if (group.length === 0) return null
            const Icon = KIND_ICON[kind]
            return (
              <section key={kind} id={`kind-${kind}`} className="mt-12 first:mt-10">
                <div className="mb-6 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[12px] font-semibold text-primary">
                    <Icon className="size-3.5" />
                    {SHARE_KIND_LABELS[kind]}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">{group.length} 条</span>
                </div>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {group.map((s) => (
                    <ShareRow key={s.id} share={s} />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </Container>
    </div>
  )
}

function ShareRow({ share: s }: { share: Share }) {
  const Icon = KIND_ICON[s.kind]
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group glass-card card-hover flex flex-col rounded-2xl p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <Icon className="size-3.5" />
          {SHARE_KIND_LABELS[s.kind]}
        </span>
        <span className="rounded-md bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {s.topic}
        </span>
      </div>
      <h3 className="mt-4 flex items-center gap-1.5 text-[15.5px] font-bold tracking-[-0.01em]">
        <Icon className="size-4 shrink-0 text-primary" />
        {s.title}
        {s.author ? <span className="text-[12px] font-normal text-muted-foreground">· {s.author}</span> : null}
      </h3>
      <p className="mt-2.5 flex-1 text-[13px] leading-[1.7] text-muted-foreground text-pretty">{s.note}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
        打开 <ArrowUpRight className="size-3.5" />
      </span>
    </a>
  )
}
