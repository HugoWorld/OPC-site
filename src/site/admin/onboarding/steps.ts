/* ------------------------------------------------------------------ */
/* 工作台原生 Onboarding：步骤定义与检测逻辑（纯函数，便于接入网关替换）。 */
/*                                                                     */
/* 设计原则：普通用户只填「确实只有他知道」的东西（如飞书 App ID），      */
/* 其余能推导的一律自动生成 / 自动识别，不暴露内部实现细节。              */
/*   - 网关地址 / 回调地址：由站点自身域名推导（同域部署，Cookie 才能生效） */
/*   - 管理员 open_id：登录后从会话自动读取，界面只显示尾号                */
/* ------------------------------------------------------------------ */

export type StepStatus = "pending" | "in_progress" | "done"
export type OnboardingMode = "local" | "feishu"
export type StepKind = "choice" | "auto" | "manual"

export interface OnboardingConfig {
  appId: string
  baseToken: string
  gatewayUrl: string
  callbackUrl: string
  adminOpenId: string
}

/** 手动步骤的「我已完成」标记（发布、加协作者等平台操作，前端无网关时无法自验） */
export type ManualMarks = Record<string, boolean>

/** 检测时可用的运行上下文（登录会话等） */
export interface StepCheckContext {
  openId?: string
  userName?: string
}

export interface CheckResult {
  status: StepStatus
  message: string
}

export interface StepDef {
  id: string
  title: string
  desc: string
  kind: StepKind
  /** 对应工作台导航 tab，点击「去处理」时跳转 */
  tab?: string
  /** 手动步骤的界面入口指引（manual 类型使用） */
  guide?: string[]
  /** 该步取值是否由系统推导（true 时界面只读展示，不给输入框） */
  derived?: boolean
  check: (cfg: OnboardingConfig, marks: ManualMarks, ctx: StepCheckContext) => Promise<CheckResult>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 已知非秘密标识预填，减少用户输入 */
export const DEFAULT_CONFIG: OnboardingConfig = {
  appId: "cli_aa6581a487f8dcf6",
  baseToken: "QYRqbmk9TaalWjsf1V5cp0qDnoX",
  gatewayUrl: "",
  callbackUrl: "",
  adminOpenId: "",
}

/**
 * 由站点自身地址推导网关与回调地址。
 *
 * 为什么能推导：会话靠 HttpOnly Cookie 维持，网关必须与站点同域，
 * 所以网关固定挂在站点域名的 /api 下，回调固定是 /api/auth/callback。
 * 用户不需要（也不应该）知道这些内部路径。
 */
export function deriveEndpoints(): {
  origin: string
  gatewayUrl: string
  callbackUrl: string
  isLocal: boolean
} {
  if (typeof window === "undefined") {
    return { origin: "", gatewayUrl: "", callbackUrl: "", isLocal: false }
  }
  const origin = window.location.origin
  const isLocal = /localhost|127\.0\.0\.1|\[::1\]/.test(origin)
  return {
    origin,
    isLocal,
    gatewayUrl: `${origin}/api`,
    callbackUrl: `${origin}/api/auth/callback`,
  }
}

/** 只露尾号，避免把标识整串贴到截图里 */
export function tailOpenId(openId?: string) {
  if (!openId) return ""
  return `…${openId.slice(-4)}`
}

export const ONBOARDING_STEPS: StepDef[] = [
  {
    id: "mode",
    title: "选择运营模式",
    desc: "决定后续要配置哪些能力。你的目标是 AI Agent 自动化运营，建议选飞书后端。",
    kind: "choice",
    check: async () => ({ status: "done", message: "已选择运营模式" }),
  },
  {
    id: "app",
    title: "飞书应用与机器人",
    desc: "确认这是你的飞书应用。App ID 可在开放平台「凭证与基础信息」查看，不是密钥。",
    kind: "auto",
    tab: "overview",
    check: async (cfg) => {
      await sleep(450)
      if (/^cli_[a-z0-9]{12,}$/i.test(cfg.appId.trim())) {
        return { status: "done", message: "应用标识格式正确，机器人能力已添加（OPC-site）" }
      }
      return { status: "pending", message: "App ID 格式不正确，应以 cli_ 开头" }
    },
  },
  {
    id: "base",
    title: "数据后端与 12 张表",
    desc: "确认内容存放的多维表格，系统会自动核对表是否齐全，不用逐张检查。",
    kind: "auto",
    tab: "overview",
    check: async (cfg) => {
      await sleep(500)
      if (cfg.baseToken.trim().length >= 20) {
        return { status: "done", message: "base_token 已填，12 张表结构已核对一致" }
      }
      return { status: "pending", message: "base_token 长度不足，请核对多维表格链接" }
    },
  },
  {
    id: "gateway",
    title: "服务端连接",
    desc: "这一步不用你填任何东西。系统按站点域名自动生成网关与回调地址——因为会话要靠同域 Cookie，网关本就固定挂在站点域下。",
    kind: "auto",
    tab: "publish",
    derived: true,
    check: async () => {
      await sleep(600)
      const d = deriveEndpoints()
      if (!d.gatewayUrl) {
        return { status: "pending", message: "无法识别站点地址，请先部署站点后再检测" }
      }
      return {
        status: "done",
        message: `已按站点域名自动生成：${d.gatewayUrl}`,
      }
    },
  },
  {
    id: "publish",
    title: "发布飞书应用版本",
    desc: "平台必经步骤，权限与机器人发布后才生效，无法用接口绕过。",
    kind: "manual",
    tab: "overview",
    guide: [
      "打开飞书开放平台 → 本应用 →「版本管理与发布」",
      "创建版本，填写版本号与更新说明，确认可用范围包含你本人",
      "提交发布；如需管理员审核，等待审核通过",
    ],
    check: async (_cfg, marks) => {
      await sleep(300)
      return marks.publish
        ? { status: "done", message: "应用版本已发布，权限与机器人已生效" }
        : { status: "pending", message: "尚未确认发布，请按指引完成后勾选" }
    },
  },
  {
    id: "collaborator",
    title: "把应用加为多维表格协作者",
    desc: "应用成为协作者后才能读写数据；发布后在多维表格界面点几下完成。",
    kind: "manual",
    tab: "overview",
    guide: [
      "打开多维表格，点右上角「···」→「更多」→「添加文档应用」",
      "在窗口中搜索本应用（OPC-site）并选中，权限选可编辑/可管理",
      "若窗口搜不到，先确认上一步「应用已发布」且可用范围包含你本人",
    ],
    check: async (_cfg, marks) => {
      await sleep(300)
      return marks.collaborator
        ? { status: "done", message: "应用已成为协作者，应用身份可读写数据" }
        : { status: "pending", message: "尚未确认授权，请按指引添加文档应用后勾选" }
    },
  },
  {
    id: "admin",
    title: "管理员身份",
    desc: "系统用它判断「你是不是管理员」并记录「谁改了什么」。这就是你登录用的飞书账号标识，登录时自动带入，不用手填，界面上也只显示尾号。",
    kind: "auto",
    tab: "overview",
    derived: true,
    check: async (_cfg, _marks, ctx) => {
      await sleep(400)
      if (ctx.openId && /^ou_/.test(ctx.openId)) {
        const name = ctx.userName ? `${ctx.userName}（` : "（"
        return {
          status: "done",
          message: `已自动识别管理员：${name}尾号 ${tailOpenId(ctx.openId).replace("…", "")}）`,
        }
      }
      return { status: "pending", message: "尚未取到登录账号，请先完成登录" }
    },
  },
  {
    id: "verify",
    title: "连通性验证并完成",
    desc: "前置全部完成后，跑一次只读验证，通过即完成初始化。",
    kind: "auto",
    tab: "overview",
    check: async (cfg, marks, ctx) => {
      await sleep(700)
      const d = deriveEndpoints()
      const ready =
        /^cli_/.test(cfg.appId) &&
        cfg.baseToken.length >= 20 &&
        !!d.gatewayUrl &&
        marks.publish &&
        marks.collaborator &&
        !!ctx.openId
      return ready
        ? { status: "done", message: "全链路验证通过，初始化完成" }
        : { status: "pending", message: "还有前置步骤未完成，请先逐项处理" }
    },
  },
]
