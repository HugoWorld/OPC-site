import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ArrowRight, ArrowUpRight, Box, ExternalLink } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useSiteData } from "@/site/admin/store"
import type { Product } from "@/site/data/products"
import { PRODUCTS_SORTED } from "@/site/data/products"

/**
 * 首页「我的产品」：自动轮播产品卡，左右按钮手动切换，居中卡片放大突出。
 * - 自动轮播间隔由工作台「产品管理 → 轮播设置」自定义（默认 4 秒，夹在 2—30 秒）；
 * - 悬停自动暂停，移开恢复；
 * - 数据由工作台「产品管理」切片驱动（图片 / 介绍 / 个性标签 / 分类 / 链接）；
 * - coverUrl 为空时用主题渐变 + 图标占位，工作台上传图片后自动替换。
 */
export function ProductsSection() {
  const { products, productCarousel } = useSiteData()
  const list = useMemo(
    () =>
      (products.length > 0 ? [...products] : PRODUCTS_SORTED)
        .filter((p) => p.published !== false)
        .sort((a, b) => a.order - b.order),
    [products]
  )
  const intervalMs = Math.min(30000, Math.max(2000, productCarousel?.intervalMs ?? 4000))
  const [active, setActive] = useState(Math.min(1, Math.max(list.length - 1, 0)))
  const [paused, setPaused] = useState(false)

  // 自动轮播：active / 间隔 / 悬停状态任一变化即重置计时
  useEffect(() => {
    if (paused || list.length < 2) return
    const t = setInterval(() => setActive((i) => (i + 1) % list.length), intervalMs)
    return () => clearInterval(t)
  }, [paused, intervalMs, list.length])

  if (list.length === 0) return null
  const move = (d: number) => setActive((i) => (i + d + list.length) % list.length)
  const n = list.length
  // 左右循环展示栏：一行始终只呈现 3 张卡（多于 3 个时按 active 取前后邻位窗口）
  const visible =
    n <= 3
      ? list
      : [active - 1, active, active + 1].map((i) => list[((i % n) + n) % n])
  const midIdx = Math.min(1, n - 1)

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 左右轮换按钮 */}
      <button
        type="button"
        aria-label="上一个产品"
        onClick={() => move(-1)}
        className="absolute -left-3 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition hover:border-primary/40 hover:text-primary md:-left-5"
      >
        <ArrowLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="下一个产品"
        onClick={() => move(1)}
        className="absolute -right-3 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition hover:border-primary/40 hover:text-primary md:-right-5"
      >
        <ArrowRight className="size-5" />
      </button>

      {/* 卡片横排：一行三卡左右循环播放展示栏，居中卡放大突出，两侧略缩小降透明度 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-5 md:gap-7">
        {visible.map((p, i) => {
          const isCenter = i === midIdx
          return (
            <ProductCard
              key={p.id}
              product={p}
              isCenter={isCenter}
              onClick={() => move(i - midIdx)}
            />
          )
        })}
      </div>

      {/* 轮换指示 + 自动轮播状态 */}
      <div className="mt-6 flex items-center justify-center gap-1.5">
        {list.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-label={`切到 ${p.name}`}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === Math.min(active, n - 1) ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/50"
            }`}
          />
        ))}
        <span className="ml-3 text-[11.5px] text-muted-foreground">
          {paused ? "已暂停 · 悬停中" : `自动轮播 · ${Math.round(intervalMs / 1000)} 秒`}
        </span>
      </div>
    </div>
  )
}

function ProductCard({
  product: p,
  isCenter,
  onClick,
}: {
  product: Product
  isCenter: boolean
  onClick: () => void
}) {
  const body = (
    <>
      {/* 封面（图片区放大）：自定义图 或 渐变占位 */}
      <div className="relative h-36 overflow-hidden sm:h-44 md:h-48">
        {p.coverUrl ? (
          <img
            src={p.coverUrl}
            alt={p.name}
            loading="lazy"
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-primary/15 via-accent to-accent2/20">
            <span className="grid size-16 place-items-center rounded-2xl border border-primary/25 bg-card/80 text-primary shadow-[0_0_28px_-6px_var(--brand-accent)]">
              <Box className="size-8" />
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <span className="absolute left-3 top-3">
          <Badge variant="secondary" className="border-border/60 bg-card/85 text-[11.5px] backdrop-blur">
            {p.category}
          </Badge>
        </span>
        {isCenter && (
          <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-md">
            当前
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-bold tracking-[-0.01em] md:text-[18px]">{p.name}</h3>
          <ArrowUpRight
            className={`size-4 shrink-0 transition md:size-4.5 ${
              isCenter ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </div>
        <p className="mt-3 text-[12.5px] leading-[1.7] text-muted-foreground text-pretty md:text-[14px] line-clamp-3">{p.intro}</p>
        <div className="mt-auto pt-5 md:pt-6">
          <div className="flex flex-wrap gap-1.5">
            {p.tags.map((t) => (
              <span
                key={t}
                className="rounded-md border border-border/70 bg-muted/60 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground md:px-2 md:text-[11.5px]"
              >
                {t}
              </span>
            ))}
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary md:text-[13px]">
            {isCenter ? "点此去看看 →" : "点卡片居中查看"}
            <ExternalLink className="size-3.5" />
          </span>
        </div>
      </div>
    </>
  )

  // HashRouter 下站内路径必须交给 Link 处理，否则会跳出 # 路由而回落到首页
  const isInternal = p.link.startsWith("/") || p.link.startsWith("#")
  const cls = `group glass-card card-hover flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ${
    isCenter
      ? "z-10 scale-[1.06] border-primary/35 shadow-lift ring-1 ring-primary/20"
      : "scale-[0.94] opacity-70 hover:opacity-90"
  }`
  const onCardClick = (e: { preventDefault: () => void }) => {
    // 非居中卡：先居中再允许跳转；居中卡直接跳转
    if (!isCenter) {
      e.preventDefault()
      onClick()
    }
  }

  return isInternal ? (
    <Link to={p.link} onClick={onCardClick} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={p.link} target="_blank" rel="noreferrer" onClick={onCardClick} className={cls}>
      {body}
    </a>
  )
}
