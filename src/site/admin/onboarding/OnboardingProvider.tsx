import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import {
  DEFAULT_CONFIG,
  ONBOARDING_STEPS,
  type CheckResult,
  type ManualMarks,
  type OnboardingConfig,
  type OnboardingMode,
  type StepDef,
  type StepStatus,
} from "@/site/admin/onboarding/steps"

const STATE_KEY = "hugow-onboarding-state-v1"

interface PersistedState {
  mode: OnboardingMode
  config: OnboardingConfig
  marks: ManualMarks
  statuses: Record<string, StepStatus>
  messages: Record<string, string>
  finished: boolean
  currentStep: string
}

interface OnboardingContextValue {
  mode: OnboardingMode
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
  setMode: (mode: OnboardingMode) => void
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
  const [mode, setModeState] = useState<OnboardingMode>(persisted.mode ?? "feishu")
  const [config, setConfig] = useState<OnboardingConfig>({ ...DEFAULT_CONFIG, ...(persisted.config ?? {}) })
  const [marks, setMarks] = useState<ManualMarks>(persisted.marks ?? {})
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>(persisted.statuses ?? {})
  const [messages, setMessages] = useState<Record<string, string>>(persisted.messages ?? {})
  const [finished, setFinished] = useState<boolean>(persisted.finished ?? false)
  const [currentStep, setCurrentStep] = useState<string>(persisted.currentStep ?? ONBOARDING_STEPS[0].id)
  const [wizardOpen, setWizardOpen] = useState(false)

  const activeSteps = useMemo(
    () => (mode === "feishu" ? ONBOARDING_STEPS : [ONBOARDING_STEPS[0]]),
    [mode],
  )

  // 首次登录（未完成）自动弹出向导；已完成则不打扰
  useEffect(() => {
    if (!finished) setWizardOpen(true)
  }, [finished])

  const persist = useCallback(
    (next: {
      mode: OnboardingMode
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
    persist({ mode, config, marks, statuses, messages, finished, currentStep })
  }, [mode, config, marks, statuses, messages, finished, currentStep, persist])

  const setMode = useCallback((m: OnboardingMode) => {
    setModeState(m)
    setStatuses((s) => ({ ...s, mode: "done" }))
    if (m === "local") {
      // 纯本地模式：无需飞书配置，直接完成
      setFinished(true)
      setWizardOpen(false)
    }
  }, [])

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
      const result = await step.check(config, marks)
      setStatuses((s) => ({ ...s, [stepId]: result.status }))
      setMessages((m) => ({ ...m, [stepId]: result.message }))
      if (stepId === "verify" && result.status === "done") {
        setFinished(true)
        setWizardOpen(false)
      }
      return result
    },
    [config, marks],
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
    setModeState("feishu")
    setConfig(DEFAULT_CONFIG)
    setMarks({})
    setStatuses({})
    setFinished(false)
    setCurrentStep(ONBOARDING_STEPS[0].id)
    setWizardOpen(true)
  }, [])

  const doneCount = activeSteps.filter((s) => statuses[s.id] === "done").length
  const progress = Math.round((doneCount / activeSteps.length) * 100)

  const value: OnboardingContextValue = {
    mode, config, marks, statuses, messages, wizardOpen, currentStep, finished,
    activeSteps, progress, doneCount,
    setMode, updateConfig, setMark, runCheck, goToStep,
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
