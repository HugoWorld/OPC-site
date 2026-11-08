import { useEffect, useState } from "react"
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
export function BaseTablePanel({ token }: { token: string }) {
  const [rows, setRows] = useState<Record<string, RowState>>(idleRows)
  const [busy, setBusy] = useState(false)

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
    void inspect()
    // 换表（token 变化）时自动重跑，保持「一进来就在核对」的体感
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

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
            <div key={t.key} className="flex items-start gap-2 rounded px-2.5 py-1.5">
              {st === "ready" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : st === "checking" ? (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-blue-600" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-[12.5px] leading-tight ${
                    st === "ready" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t.label}
                </div>
                <div className="mt-0.5 truncate text-[10.5px] leading-tight text-muted-foreground/80">
                  {t.hint}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-2.5">
        <div className="text-[11.5px] text-muted-foreground">
          {busy
            ? "正在逐张核对，稍等片刻"
            : missing > 0
              ? `发现 ${missing} 张表未就绪，可一键补齐`
              : `${TABLE_MANIFEST.length} 张表结构完整，无需补齐`}
        </div>
        <Button
          variant={!busy && missing > 0 ? "default" : "outline"}
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
