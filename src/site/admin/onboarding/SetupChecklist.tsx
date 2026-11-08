import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useOnboarding } from "@/site/admin/onboarding/OnboardingProvider"
import type { StepStatus } from "@/site/admin/onboarding/steps"

function StepIcon({ status }: { status?: StepStatus }) {
  if (status === "done") return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
  if (status === "in_progress") return <Loader2 className="size-4 shrink-0 animate-spin text-blue-600" />
  return <Circle className="size-4 shrink-0 text-muted-foreground/60" />
}

/**
 * 总览页常驻配置清单：与向导共享状态。
 * 未完成时显示在总览顶部，全部完成后折叠为一条完成提示，可随时重新打开。
 */
export function SetupChecklist() {
  const ob = useOnboarding()

  if (ob.finished) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <div>
            <div className="text-[14.5px] font-semibold text-emerald-700">初始化已完成</div>
            <div className="text-[12px] text-muted-foreground">
              运营模式：{ob.mode === "feishu" ? "飞书后端 + 自动化" : "纯本地模式"}
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              接下来：在左侧模块补内容 → 右侧预览 → 点「发布」让前台生效
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={ob.openWizard}>
            查看配置
          </Button>
          <Button variant="ghost" size="sm" onClick={ob.reset}>
            重新配置
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </span>
          <div>
            <div className="text-[15px] font-bold">完成初始化配置</div>
            <div className="text-[12px] text-muted-foreground">逐项处理，即可用 AI Agent 自动化运营</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-extrabold text-primary">{ob.progress}%</div>
          <div className="text-[11px] text-muted-foreground">
            {ob.doneCount}/{ob.activeSteps.length} 已完成
          </div>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${ob.progress}%` }} />
      </div>

      <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {ob.activeSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => {
              ob.goToStep(step.id)
              ob.openWizard()
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60"
          >
            <StepIcon status={ob.statuses[step.id]} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{step.title}</span>
            {step.kind === "manual" && ob.statuses[step.id] !== "done" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] text-muted-foreground">需手动</span>
            )}
          </button>
        ))}
      </div>

      <Button className="mt-4 w-full" onClick={ob.openWizard}>
        打开配置向导
      </Button>
    </div>
  )
}
