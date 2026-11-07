import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

/** 区块头：两位序号 + 标题 + 一句人话 + 右侧「查看全部」。 */
export function SectionHead({
  num,
  title,
  lead,
  more,
  level = "h2",
}: {
  num?: string
  title: string
  lead?: string
  more?: { label: string; href: string } | null
  /** 标题层级：独立页面主标题用 h1，页内区块用 h2（默认） */
  level?: "h1" | "h2"
}) {
  const Heading = level
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {num && (
          <div className="seq mb-3" aria-hidden>
            {num}
          </div>
        )}
        <Heading className="text-gradient text-[clamp(1.6rem,3.2vw,2.3rem)] font-extrabold tracking-[-0.02em] text-balance">
          {title}
        </Heading>
        {lead && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground text-pretty">{lead}</p>
        )}
      </div>
      {more && (
        <Link
          to={more.href}
          className="group inline-flex items-center gap-1.5 text-[14px] font-medium text-primary transition-colors hover:text-primary/80"
        >
          {more.label}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}

/** 页面主体容器：统一最大宽度与左右留白。 */
export function Container({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto w-full max-w-[1120px] px-6 ${className}`}>{children}</div>
  )
}

/** 章节容器：固定纵向节奏。 */
export function Section({
  id,
  anchor,
  children,
  className = "",
}: {
  id?: string
  /** 预览锚点：工作台编辑时定位高亮用 */
  anchor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      data-preview-anchor={anchor}
      className={`relative px-6 py-[var(--density-section-y)] md:px-8 md:py-[var(--density-section-y-md)] ${className}`}
    >
      <Container>{children}</Container>
    </section>
  )
}
