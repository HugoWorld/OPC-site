import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import {
  DEFAULT_CONFIG,
  ONBOARDING_STEPS,
  deriveEndpoints,
  type CheckResult,
  type ManualMarks,
  type OnboardingConfig,
  type StepDef,
  type StepStatus,
} from "@/site/admin/onboarding/steps"
import { loadSession } from "@/site/admin/auth"

const STATE_KEY = "hugow-onboarding-state-v1"

interface PersistedState {
  config: OnboardingConfig
  marks: ManualMarks
  statuses: Record<string, StepStatus>
  messages: Record<string, string>
  finished: boolean
  currentStep: string
}

interface OnboardingContextValue {
  config: OnboardingConfig
  marks: ManualMarks
  statuses: Record<string, StepStatus>
  messages: Record<string, string>
  wizardOpen: boolean
  currentStep: string
  finished: boolean
  activeSteps: StepDef[]
  progress: number
  doneCount: number
  /** 系统按站点域名推导出的网关/回调地址（只读展示） */
  derived: { origin: string; gatewayUrl: string; callbackUrl: string; isLocal: boolean }
  /** 当前登录会话（管理员身份来源） */
  sessionName?: string
  sessionOpenId?: string
  updateConfig: (patch: Partial<OnboardingConfig>) => void
  setMark: (stepId: string, value: boolean) => void
  runCheck: (stepId: string) => Promise<CheckResult>
  goToStep: (stepId: string) => void
  openWizard: () => void
  closeWizard: () => void
  next: () => void
  prev: () => void
  reset: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

function loadPersisted(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    return raw ? (JSON.parse(raw) as PersistedState) : {}
  } catch {
    return {}
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const persisted = useMemo(loadPersisted, [])
  // 登录会话：管理员身份与网关地址都从这里自动推导，不让用户手填
  const session = useMemo(loadSession, [])
  const endpoints = useMemo(deriveEndpoints, [])
  const checkCtx = useMemo(
    () => ({ openId: session?.openId, userName: session?.name }),
    [session],
  )

  const [config, setConfig] = useState<OnboardingConfig>(() => {
    // 网域与管理员身份始终以「当前环境 + 当前登录」为准，不允许沿用历史值
    const base = { ...DEFAULT_CONFIG, ...(persisted.config ?? {}) }
    return {
      ...base,
      gatewayUrl: endpoints.gatewayUrl,
      callbackUrl: endpoints.callbackUrl,
      adminOpenId: session?.openId ?? "",
    }
  })
  const [marks, setMarks] = useState<ManualMarks>(persisted.marks ?? {})
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>(persisted.statuses ?? {})
  const [messages, setMessages] = useState<Record<string, string>>(persisted.messages ?? {})
  // 只有「连通性验证」真的通过才算初始化完成；旧版纯本地模式留下的 finished 不再冒充完成
  const [finished, setFinished] = useState<boolean>(
    Boolean(persisted.finished) && persisted.statuses?.verify === "done",
  )
  // 步骤会随版本增减：历史持久值里的 currentStep 若已不存在，回落到第一步
  const [currentStep, setCurrentStep] = useState<string>(() =>
    ONBOARDING_STEPS.some((s) => s.id === persisted.currentStep)
      ? (persisted.currentStep as string)
      : ONBOARDING_STEPS[0].id,
  )
  const [wizardOpen, setWizardOpen] = useState(false)

  const activeSteps = ONBOARDING_STEPS

  // 首次登录（未完成）自动弹出向导；已完成则不打扰
  useEffect(() => {
    if (!finished) setWizardOpen(true)
  }, [finished])

  const persist = useCallback(
    (next: {
      config: OnboardingConfig
      marks: ManualMarks
      statuses: Record<string, StepStatus>
      messages: Record<string, string>
      finished: boolean
      currentStep: string
    }) => {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify(next))
      } catch {
        /* 隐私模式下降级为仅内存 */
      }
    },
    [],
  )

  useEffect(() => {
    persist({ config, marks, statuses, messages, finished, currentStep })
  }, [config, marks, statuses, messages, finished, currentStep, persist])

  const updateConfig = useCallback((patch: Partial<OnboardingConfig>) => {
    setConfig((c) => ({ ...c, ...patch }))
  }, [])

  const setMark = useCallback((stepId: string, value: boolean) => {
    setMarks((m) => ({ ...m, [stepId]: value }))
  }, [])

  const runCheck = useCallback(
    async (stepId: string) => {
      const step = ONBOARDING_STEPS.find((s) => s.id === stepId)
      if (!step) return { status: "pending" as StepStatus, message: "步骤不存在" }
      setStatuses((s) => ({ ...s, [stepId]: "in_progress" }))
      const result = await step.check(config, marks, checkCtx)
      setStatuses((s) => ({ ...s, [stepId]: result.status }))
      setMessages((m) => ({ ...m, [stepId]: result.message }))
      if (stepId === "verify" && result.status === "done") {
        setFinished(true)
        setWizardOpen(false)
      }
      return result
    },
    [config, marks, checkCtx],
  )

  const goToStep = useCallback((stepId: string) => setCurrentStep(stepId), [])

  const openWizard = useCallback(() => setWizardOpen(true), [])
  const closeWizard = useCallback(() => setWizardOpen(false), [])

  const stepIndex = activeSteps.findIndex((s) => s.id === currentStep)
  const next = useCallback(() => {
    const i = activeSteps.findIndex((s) => s.id === currentStep)
    if (i >= 0 && i < activeSteps.length - 1) setCurrentStep(activeSteps[i + 1].id)
  }, [activeSteps, currentStep])

  const prev = useCallback(() => {
    const i = activeSteps.findIndex((s) => s.id === currentStep)
    if (i > 0) setCurrentStep(activeSteps[i - 1].id)
  }, [activeSteps, currentStep])

  const reset = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setMarks({})
    setStatuses({})
    setFinished(false)
    setCurrentStep(ONBOARDING_STEPS[0].id)
    setWizardOpen(true)
  }, [])

  // 进入某步即自动检测，用户无需再点「自动检测」（手动步骤除外）
  useEffect(() => {
    if (!wizardOpen) return
    const step = activeSteps.find((s) => s.id === currentStep)
    if (!step || step.kind === "manual") return
    // 已完成的不重跑；未完成的每次进入都按当前配置重算一次
    if (statuses[step.id] === "done") return
    void runCheck(step.id)
    // 仅在切步 / 打开向导时触发，状态变化不再重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, wizardOpen])

  // 手动步骤勾选「已完成」后立刻重算状态，不需要用户再点一次检测
  useEffect(() => {
    if (!wizardOpen) return
    const step = activeSteps.find((s) => s.id === currentStep)
    if (!step || step.kind !== "manual") return
    if (!marks[step.id]) return
    if (statuses[step.id] === "done") return
    void runCheck(step.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marks, currentStep, wizardOpen])

  const doneCount = activeSteps.filter((s) => statuses[s.id] === "done").length
  const progress = Math.round((doneCount / activeSteps.length) * 100)

  const value: OnboardingContextValue = {
    config, marks, statuses, messages, wizardOpen, currentStep, finished,
    activeSteps, progress, doneCount,
    derived: endpoints,
    sessionName: session?.name,
    sessionOpenId: session?.openId,
    updateConfig, setMark, runCheck, goToStep,
    openWizard, closeWizard, next, prev, reset,
  }

  // stepIndex 仅用于边界判断，避免未使用告警
  void stepIndex

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider")
  return ctx
}
