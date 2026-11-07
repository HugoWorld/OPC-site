import { useEffect } from "react"

/**
 * 预览模式桥：工作台通过 postMessage 下发「定位 + 高亮」指令。
 * 仅在 URL 带 ?preview=1 时挂载（由 SiteApp 条件渲染，内部再自检一次）。
 *
 * 指令协议：
 *   { type: "locate", path: "/", anchor: "hero" }
 *   { type: "highlight", path: "/solutions/", anchor: "solution-<id>" }
 *   { type: "flash", durationMs: 2000 }
 */
export function PreviewBridge() {
  useEffect(() => {
    const isPreview = new URLSearchParams(window.location.search).get("preview") === "1"
    // hash 形式：http://host/#/?preview=1 时 search 为空，读 hash 内参数
    const hashPreview = /[?&]preview=1/.test(window.location.hash)
    if (!isPreview && !hashPreview) return

    const applyHighlight = (anchor: string, durationMs = 2200) => {
      const el = document.querySelector<HTMLElement>(`[data-preview-anchor="${anchor}"]`)
      if (!el) {
        // 回退：按 id 查找
        const byId = document.getElementById(anchor)
        if (byId) return flash(byId, durationMs)
        return
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      flash(el, durationMs)
    }

    const flash = (el: HTMLElement, durationMs: number) => {
      el.classList.add("preview-flash")
      window.setTimeout(() => el.classList.remove("preview-flash"), durationMs)
    }

    const onMessage = (e: MessageEvent) => {
      const msg = e.data
      if (!msg || typeof msg !== "object") return
      if (msg.type === "locate" && msg.anchor) {
        // 需要跳路由的情况：path 与当前不一致时由工作台先用 window.location 导航；
        // 这里只负责滚动定位与高亮（导航由预览 iframe 自己的 hash 变化驱动）
        requestAnimationFrame(() => applyHighlight(msg.anchor, msg.durationMs ?? 2200))
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  return null
}
