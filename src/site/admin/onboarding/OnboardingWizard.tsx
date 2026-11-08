import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useOnboarding } from "@/site/admin/onboarding/OnboardingProvider"
import type { OnboardingConfig } from "@/site/admin/onboarding/steps"
import type { StepStatus } from "@/site/admin/onboarding/steps"

type FieldDef = { key: keyof OnboardingConfig; label: string; placeholder: string }

const FIELDS: Record<string, FieldDef[]> = {
  app: [{ key: "appId", label: "App ID", placeholder: "cli_xxxxxxxx" }],
  base: [{ key: "baseToken", label: "Base Token", placeholder: "多维表格 app_token" }],
  gateway: [
    { key: "gatewayUrl", label: "网关地址", placeholder: "https://your-gateway/" },
    { key: "callbackUrl", label: "回调地址", placeholder: "https://your-site/callback" },
  ],
  admin: [{ key: "adminOpenId", label: "管理员 Open ID", placeholder: "ou_xxxxxxxx" }],
}

function StatusLine({ status, message }: { status?: StepStatus; message?: string }) {
  if (!status) return null
  if (status === "in_progress") {
    return (
      <div className="flex items-center gap-2 text-[13px] text-blue-600">
        <Loader2 className="size-4 animate-spin" /> 正在检测…
      </div>
    )
  }
  if (status === "done") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-700">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {message ?? "已完成"}
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700">
      {message ?? "尚未完成"}
    </div>
  )
}

function StepBody({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const ob = useOnboarding()
  const step = ob.activeSteps.find((s) => s.id === ob.currentStep) ?? ob.activeSteps[0]
  const status = ob.statuses[step.id]
  const fields = FIELDS[step.id]

  // 第一步：模式选择
  if (step.id === "mode") {
    const options = [
      { value: "feishu" as const, title: "飞书后端 + 自动化", desc: "数据上云、多设备同步，支持 AI Agent 无人值守" },
      { value: "local" as const, title: "纯本地模式", desc: "数据存浏览器，无需网关，适合固定电脑自用" },
    ]
    return (
      <div className="space-y-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => ob.setMode(o.value)}
            className={`w-full rounded-xl border p-4 text-left transition-colors ${
              ob.mode === o.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <div className="text-[14.5px] font-semibold">{o.title}</div>
            <div className="mt-1 text-[12.5px] text-muted-foreground">{o.desc}</div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">{step.desc}</p>

      {fields && (
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[12.5px] font-medium">{f.label}</label>
              <Input
                value={ob.config[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => ob.updateConfig({ [f.key]: e.target.value })}
                className="h-10 text-[13px]"
              />
            </div>
          ))}
        </div>
      )}

      {step.kind === "manual" && step.guide && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <ol className="m-0 list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed">
            {step.guide.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ol>
          <label className="mt-3 flex items-center gap-2 text-[12.5px] font-medium">
            <input
              type="checkbox"
              checked={!!ob.marks[step.id]}
              onChange={(e) => ob.setMark(step.id, e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            我已按指引完成这一步
          </label>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={status === "in_progress"}
        onClick={() => ob.runCheck(step.id)}
      >
        {status === "in_progress" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {status === "done" ? "重新检测" : "自动检测当前状态"}
      </Button>

      <StatusLine status={status} message={ob.messages[step.id]} />

      {step.tab && (
        <button
          type="button"
          onClick={() => {
            onNavigateTab?.(step.tab as string)
            ob.closeWizard()
          }}
          className="w-full text-[12px] font-medium text-primary hover:underline"
        >
          跳转到对应工作台模块处理 →
        </button>
      )}
    </div>
  )
}

export function OnboardingWizard({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const ob = useOnboarding()
  const index = ob.activeSteps.findIndex((s) => s.id === ob.currentStep)
  const isLast = index === ob.activeSteps.length - 1

  return (
    <Sheet open={ob.wizardOpen} onOpenChange={(o) => (o ? ob.openWizard() : ob.closeWizard())}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border">
          <SheetTitle>初始化配置向导</SheetTitle>
          <SheetDescription>完成后即可用 AI Agent / 工作流自动化运营，进度自动保存</SheetDescription>
          <div className="mt-2">
            <div className="mb-1.5 flex justify-between text-[11.5px] text-muted-foreground">
              <span>
                第 {index + 1} / {ob.activeSteps.length} 步
              </span>
              <span>{ob.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${ob.progress}%` }} />
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-auto p-5">
          <StepBody onNavigateTab={onNavigateTab} />
        </div>

        <SheetFooter className="border-t border-border">
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={ob.prev} disabled={index <= 0} className="gap-1">
              <ChevronLeft className="size-4" /> 上一步
            </Button>
            <Button variant="ghost" size="sm" onClick={ob.closeWizard}>
              稍后处理
            </Button>
            <Button size="sm" onClick={ob.next} disabled={isLast} className="gap-1">
              下一步 <ChevronRight className="size-4" />
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
