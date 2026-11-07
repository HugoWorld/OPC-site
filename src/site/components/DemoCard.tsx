import { useEffect, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useSiteData } from "@/site/admin/store"

/**
 * Hero 右侧的轮换演示卡：
 * - 内容完全由工作台 DEMOS 切片驱动（自定义只改数据）；
 * - tab 点击切换；鼠标悬停暂停自动轮换；
 * - 尊重 prefers-reduced-motion（用户偏好减少动态时不自动轮换）。
 */
export function DemoCard() {
  const { demos } = useSiteData()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  useEffect(() => {
    if (reduceMotion || pausedRef.current) return
    if (demos.length === 0) return
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % demos.length)
    }, 5000)
    return () => window.clearInterval(t)
  }, [reduceMotion, active, demos.length])

  if (demos.length === 0) return null
  const panel = demos[Math.min(active, demos.length - 1)]

  return (
    <Card
      className="animate-fade-up glass-card card-hover overflow-hidden p-0 shadow-lift"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 顶栏：现场演示徽章 + 窗口标题 + 轮换状态 */}
      <div className="flex items-center gap-2 border-b border-border bg-white/5 px-4 py-3">
        <span className="shrink-0 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          现场演示
        </span>
        <span className="min-w-0 truncate text-[12.5px] font-semibold text-foreground/90">
          {panel.windowTitle}
        </span>
        <span className="ml-auto hidden shrink-0 text-[11px] text-muted-foreground/70 sm:block">
          {paused ? "已暂停" : "自动轮换 · 悬停暂停"}
        </span>
      </div>

      {/* 一句话说明：访客不用猜这是什么 */}
      <p className="px-5 pt-4 text-[12px] leading-relaxed text-muted-foreground">
        我交付的东西，运行起来长这样——数据为演示示例，点下方标签切换场景。
      </p>

      {/* 行内容 */}
      <div className="space-y-3 p-5">
        {panel.rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 rounded-xl border border-border bg-gradient-to-br from-card to-card/70 px-4 py-3 transition hover:border-primary/30 hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-foreground">{row.label}</div>
              <div className="mt-1 truncate font-mono text-[11.5px] text-muted-foreground">
                {row.meta}
              </div>
            </div>
            <Badge
              variant={row.variant ?? "default"}
              className="shrink-0 px-2 py-1 text-[11.5px] font-semibold"
            >
              {row.status}
            </Badge>
          </div>
        ))}

        {/* 底部统计 + 进度 */}
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <span className="truncate text-[13.5px] font-semibold text-foreground/90">{panel.summary}</span>
          <span className="shrink-0 font-mono text-[13px] font-bold text-primary">{panel.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent2 transition-all duration-500"
            style={{ width: `${panel.progress}%` }}
          />
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-1.5 border-t border-border bg-white/5 px-4 py-2.5">
        {demos.map((d, i) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={`rounded-full px-3 py-1 text-[12.5px] font-medium transition-all ${
              i === active
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "text-muted-foreground hover:bg-border hover:text-foreground"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
    </Card>
  )
}
