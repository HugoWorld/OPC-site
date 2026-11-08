import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Circle, Loader2, RefreshCw, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TABLE_MANIFEST } from "@/site/admin/onboarding/steps"

type RowState = "idle" | "checking" | "ready"

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 12 张表的初始状态：全部未检测（灰） */
function idleRows(): Record<string, RowState> {
  return Object.fromEntries(TABLE_MANIFEST.map((t) => [t.key, "idle" as RowState]))
}

/**
 * 第 3 步的表结构核对面板。
 *
 * 交互设计：进入步骤即逐张自动核对，灰色 → 转圈 → 打勾，用户不需要填任何东西；
 * 核对发现缺表或结构不全时，出现「自动补齐」按钮一键处理。
 *
 * 说明：当前为本地模拟核对（无网关时的占位），接入网关后把 inspect 换成真实接口即可，
 * 界面与状态机不变。
 */
export function BaseTablePanel() {
  const [rows, setRows] = useState<Record<string, RowState>>(idleRows)
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  const inspect = async () => {
    setBusy(true)
    setRows(idleRows())
    for (const t of TABLE_MANIFEST) {
      setRows((prev) => ({ ...prev, [t.key]: "checking" }))
      await wait(150)
      // 12 张表均已存在于该多维表格（结构以网关返回为准，此处模拟通过）
      setRows((prev) => ({ ...prev, [t.key]: "ready" }))
      await wait(60)
    }
    setBusy(false)
  }

  const fillMissing = async () => {
    setBusy(true)
    for (const t of TABLE_MANIFEST) {
      if (rows[t.key] === "ready") continue
      setRows((prev) => ({ ...prev, [t.key]: "checking" }))
      await wait(380)
      setRows((prev) => ({ ...prev, [t.key]: "ready" }))
    }
    setBusy(false)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void inspect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ready = TABLE_MANIFEST.filter((t) => rows[t.key] === "ready").length
  const missing = TABLE_MANIFEST.length - ready
  const pct = Math.round((ready / TABLE_MANIFEST.length) * 100)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <div>
          <div className="text-[12.5px] font-semibold">全部多维表格</div>
          <div className="text-[11px] text-muted-foreground">
            {ready}/{TABLE_MANIFEST.length} 张已就绪{busy ? " · 核对中…" : ""}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-1" disabled={busy} onClick={() => void inspect()}>
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> 重新核对
        </Button>
      </div>

      <div className="h-1 w-full bg-muted">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid gap-x-3 px-1 py-1.5 sm:grid-cols-2">
        {TABLE_MANIFEST.map((t) => {
          const st = rows[t.key]
          return (
            <div key={t.key} className="flex items-center gap-2 rounded px-2.5 py-1.5">
              {st === "ready" ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              ) : st === "checking" ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-blue-600" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/50" />
              )}
              <span
                className={`min-w-0 flex-1 truncate text-[12.5px] ${
                  st === "ready" ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {t.label}
              </span>
              <span className="font-mono text-[10.5px] text-muted-foreground/70">
                …{t.tableId.slice(-4)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-2.5">
        <div className="text-[11.5px] text-muted-foreground">
          {missing > 0 ? `发现 ${missing} 张表未就绪` : "12 张表结构完整，无需补齐"}
        </div>
        <Button
          variant={missing > 0 ? "default" : "outline"}
          size="sm"
          className="gap-1"
          disabled={busy || missing === 0}
          onClick={() => void fillMissing()}
        >
          <Wand2 className="size-3.5" /> 自动补齐缺失表
        </Button>
      </div>
    </div>
  )
}
