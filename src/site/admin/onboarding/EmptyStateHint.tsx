import { Inbox } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * 模块空状态引导：数据被清空时，不显示空白，而是告诉用户下一步做什么。
 * 可接「打开初始化向导」或「添加一项」等动作。
 */
export function EmptyStateHint({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string
  hint: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-muted">
        <Inbox className="size-5 text-muted-foreground" />
      </span>
      <div className="mt-3 text-[14.5px] font-semibold">{title}</div>
      <p className="mt-1 max-w-[44ch] text-[12.5px] leading-relaxed text-muted-foreground">{hint}</p>
      {actionLabel && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
