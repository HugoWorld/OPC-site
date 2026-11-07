import { useMemo, useState } from "react"
import { Box, ExternalLink, Play } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useSiteData } from "@/site/admin/store"
import type { DemoVideo } from "@/site/data/home"
import { PRODUCTS_SORTED, type Product } from "@/site/data/products"

/** 可内嵌播放的媒体地址（mp4/webm/mov/ogg/m3u8）——其余视为跳转链接 */
const EMBED_RE = /\.(mp4|webm|mov|ogg|m3u8)(\?|$)/i

/**
 * 首页「产品与演示」：左侧自定义产品列，点击切换右侧该产品的演示视频。
 * - 视频播放框放大、只突出播放；无视频时提示到工作台上传；
 * - 产品列来自「产品管理」切片；视频来自「演示视频」切片（按 demoVideoId 或产品名匹配）。
 */
export function DemoSection() {
  const { products, demoVideos } = useSiteData()
  const list = useMemo(
    () =>
      (products.length > 0 ? [...products] : PRODUCTS_SORTED)
        .filter((p) => p.published !== false)
        .sort((a, b) => a.order - b.order),
    [products]
  )
  const videos = useMemo(
    () =>
      (demoVideos ?? [])
        .filter((v) => v.published !== false)
        .sort((a, b) => a.order - b.order),
    [demoVideos]
  )
  const [sel, setSel] = useState(0)
  const active = list.length > 0 ? list[Math.min(sel, list.length - 1)] : undefined
  const video = useMemo(() => {
    if (!active) return undefined
    const byId = videos.find((v) => v.id === active.demoVideoId)
    if (byId) return byId
    return videos.find((v) => v.productName === active.name)
  }, [active, videos])

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
      {/* 左：自定义产品列 */}
      <div className="rounded-2xl border border-border/70 bg-card/50 p-3.5">
        <div className="mb-3 px-3 pt-1.5 text-[12.5px] font-semibold text-muted-foreground">
          选择产品看演示
        </div>
        {list.length === 0 ? (
          <p className="px-3 pb-3 text-[12.5px] text-muted-foreground">
            到工作台「产品管理」添加产品后，这里会出现产品列。
          </p>
        ) : (
          <div className="space-y-2.5">
            {list.map((p, i) => {
              const isActive = i === Math.min(sel, list.length - 1)
              return (
                <ProductRow
                  key={p.id}
                  product={p}
                  isActive={isActive}
                  onClick={() => setSel(i)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* 右：大视频播放区（只突出播放） */}
      <div>
        {video ? (
          <VideoPlayer video={video} productName={active?.name ?? ""} />
        ) : (
          <div className="glass-card flex min-h-[300px] flex-col items-center justify-center rounded-2xl px-6 text-center lg:min-h-[380px]">
            <span className="grid size-14 place-items-center rounded-2xl bg-muted/80 text-muted-foreground">
              <Play className="size-6" />
            </span>
            <p className="mt-4 text-[15px] font-semibold">
              {active ? `${active.name} · 还没有演示视频` : "还没有演示视频"}
            </p>
            <p className="mt-2 max-w-[40ch] text-[13px] leading-relaxed text-muted-foreground">
              到工作台「产品管理 → 演示视频」为「{active?.name ?? "每个产品"}」上传视频，
              这里会自动播放。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductRow({
  product: p,
  isActive,
  onClick,
}: {
  product: Product
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3.5 text-left transition-colors ${
        isActive
          ? "border border-primary/30 bg-primary/10"
          : "border border-transparent hover:border-border hover:bg-muted/40"
      }`}
    >
      {p.coverUrl ? (
        <img
          src={p.coverUrl}
          alt=""
          className="size-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/20 bg-gradient-to-br from-primary/12 via-accent to-accent2/15 text-primary">
          <Box className="size-4.5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13.5px] font-semibold ${isActive ? "text-primary" : ""}`}>
          {p.name}
        </span>
        <span className="block truncate text-[11.5px] text-muted-foreground">{p.category}</span>
      </span>
      {isActive && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
    </button>
  )
}

function VideoPlayer({ video: v, productName }: { video: DemoVideo; productName: string }) {
  const embeddable = EMBED_RE.test(v.videoUrl)
  const inner = (
    <>
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {embeddable ? (
          <video
            src={v.videoUrl}
            poster={v.coverUrl || undefined}
            controls
            playsInline
            preload="metadata"
            className="size-full object-contain bg-black"
          />
        ) : v.coverUrl ? (
          <img src={v.coverUrl} alt={v.title} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-primary/15 via-accent to-accent2/20">
            <span className="grid size-16 place-items-center rounded-full bg-card/85 text-primary shadow-[0_0_28px_-4px_var(--brand-accent)] transition group-hover:scale-110">
              <Play className="size-7 fill-current" />
            </span>
          </div>
        )}
        {!embeddable && (
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        )}
        {v.durationText ? (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/70 px-2 py-1 font-mono text-[12px] text-white">
            {v.durationText}
          </span>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-3 p-6">
        <div className="min-w-0">
          {productName ? (
            <div className="text-[12px] font-medium text-primary">{productName}</div>
          ) : null}
          <h4 className="mt-1 text-[15.5px] font-semibold">{v.title}</h4>
          {v.desc ? <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{v.desc}</p> : null}
        </div>
        <Badge variant="secondary" className="shrink-0 border-border/60">
          {embeddable ? "在线播放" : "外链视频"}
        </Badge>
      </div>
    </>
  )

  if (embeddable) {
    return <div className="glass-card overflow-hidden rounded-2xl">{inner}</div>
  }
  return (
    <a
      href={v.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group glass-card card-hover block overflow-hidden rounded-2xl"
    >
      {inner}
      <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-[13px] font-semibold text-primary">
        点击播放
        <ExternalLink className="size-4" />
      </div>
    </a>
  )
}
