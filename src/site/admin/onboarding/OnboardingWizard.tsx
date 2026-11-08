import { CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, RefreshCw, Wand2 } from "lucide-react"

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

import guidePublish1 from "@/site/assets/onboarding/guide-publish-1.png"
import guidePublish2 from "@/site/assets/onboarding/guide-publish-2.png"
import guidePublish3 from "@/site/assets/onboarding/guide-publish-3.png"
import guideCollab1 from "@/site/assets/onboarding/guide-collab-1.png"
import guideCollab2 from "@/site/assets/onboarding/guide-collab-2.png"
import guideCollab3 from "@/site/assets/onboarding/guide-collab-3.png"

type FieldDef = { key: keyof OnboardingConfig; label: string; placeholder: string }

const FIELDS: Record<string, FieldDef[]> = {
  app: [{ key: "appId", label: "App ID", placeholder: "cli_xxxxxxxx" }],
  base: [{ key: "baseToken", label: "Base Token", placeholder: "多维表格 app_token" }],
}

/** 手动步骤的分步界面图示：一张图对应一个动作，图上红框 + 序号即该点哪里 */
type Shot = { src: string; caption: string }

const GUIDE_SHOTS: Record<string, Shot[]> = {
  publish: [
    {
      src: guidePublish1,
      caption:
        "打开飞书开放平台 → 选中本应用「OPC-site」→ 左侧「应用发布」→「版本管理与发布」，点右上角「创建版本」。",
    },
    {
      src: guidePublish2,
      caption:
        "在版本详情里填版本号（如 1.0.0）和一句更新说明，可用范围保持「仅我」即可，然后点「保存」。",
    },
    {
      src: guidePublish3,
      caption:
        "保存后回到版本详情页，点右侧「申请线上发布」。若弹出确认框点了取消，这里同样能补提交。",
    },
  ],
  collaborator: [
    {
      src: guideCollab1,
      caption:
        "打开这张多维表格，点右上角「···」，在菜单最后选「···更多」，再展开「添加文档应用」。",
    },
    {
      src: guideCollab2,
      caption:
        "弹窗里搜索「OPC-site」，选中带「企业自建应用」标签的那条，再点「添加」。",
    },
    {
      src: guideCollab3,
      caption:
        "权限选「可编辑」；如果这张表开启了高级权限，要选「可管理」，否则应用仍读不到数据。",
    },
  ],
}


/** 只读的「系统已自动生成」展示块 */
function DerivedRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="text-[11.5px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-all font-mono text-[12px] text-foreground">{value || "—"}</div>
      {hint && <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  )
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
  const shots = GUIDE_SHOTS[step.id]

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

      {/* 系统自动生成的项：只读展示，不给输入框 */}
      {step.derived && step.id === "gateway" && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-700">
            <Wand2 className="size-3.5" /> 已按你的站点地址自动生成
          </div>
          <DerivedRow label="网关地址" value={ob.derived.gatewayUrl} hint="站点域名下的 /api，由平台自动路由" />
          <DerivedRow label="回调地址" value={ob.derived.callbackUrl} hint="登录完成后回到工作台" />
          {ob.derived.isLocal && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-700">
              当前是本地开发地址。正式部署到云平台后，这两个地址会随域名自动变化，无需重新配置。
            </div>
          )}
        </div>
      )}

      {step.derived && step.id === "admin" && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-700">
            <Wand2 className="size-3.5" /> 已从当前登录账号自动识别
          </div>
          <DerivedRow
            label="管理员"
            value={
              ob.sessionOpenId
                ? `${ob.sessionName ?? "已登录"}　尾号 ${ob.sessionOpenId.slice(-4)}`
                : "—"
            }
            hint="完整标识只保存在服务端白名单，界面仅显示尾号"
          />
        </div>
      )}

      {step.kind === "manual" && shots && (
        <div className="space-y-3">
          {shots.map((s, i) => (
            <figure key={s.src} className="m-0 overflow-hidden rounded-xl border border-border bg-card">
              <a
                href={s.src}
                target="_blank"
                rel="noreferrer"
                title="点击查看大图"
                className="block border-b border-border bg-muted/20"
              >
                <img
                  src={s.src}
                  alt={`第 ${i + 1} 步界面位置示意`}
                  loading="lazy"
                  className="w-full"
                />
              </a>
              <figcaption className="flex gap-2 px-3 py-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-[12.5px] leading-relaxed text-muted-foreground">{s.caption}</span>
              </figcaption>
            </figure>
          ))}

          {step.tips && step.tips.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700">
                <Info className="size-3.5" /> 卡住了先看这里
              </div>
              <ul className="m-0 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-amber-800">
                {step.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] font-medium">
            <input
              type="checkbox"
              checked={!!ob.marks[step.id]}
              onChange={(e) => ob.setMark(step.id, e.target.checked)}
              className="size-4 accent-emerald-600"
            />
            我已按上面的图示完成这一步
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
