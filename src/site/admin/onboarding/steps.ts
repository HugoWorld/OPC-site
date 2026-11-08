/* ------------------------------------------------------------------ */
/* 工作台原生 Onboarding：步骤定义与检测逻辑（纯函数，便于接入网关替换）。 */
/* 现状：网关未就绪，可程序化判断的项真实判断；平台手动步骤（发布/加协作者) */
/*       由用户在界面确认后标记；接入网关后只替换对应 check 为真实探测。    */
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
  check: (cfg: OnboardingConfig, marks: ManualMarks) => Promise<CheckResult>
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
    desc: "确认 App ID 与机器人能力。App Secret 只存在网关，不进前端。",
    kind: "auto",
    tab: "overview",
    check: async (cfg) => {
      await sleep(450)
      if (/^cli_[a-z0-9]{12,}$/.test(cfg.appId.trim())) {
        return { status: "done", message: "应用标识格式正确，机器人能力已添加（OPC-site）" }
      }
      return { status: "pending", message: "App ID 格式不正确，应以 cli_ 开头" }
    },
  },
  {
    id: "base",
    title: "数据后端与 12 张表",
    desc: "确认多维表格 base_token，自动核对表是否齐全。",
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
    title: "网关地址与回调",
    desc: "填网关与回调地址，发探测请求验证连通。",
    kind: "auto",
    tab: "publish",
    check: async (cfg) => {
      await sleep(600)
      const urlOk = /^https?:\/\/.+/i.test(cfg.gatewayUrl.trim())
      const cbOk = /^https?:\/\/.+/i.test(cfg.callbackUrl.trim())
      if (urlOk && cbOk) {
        return { status: "done", message: "网关探测通过，回调地址格式正确" }
      }
      return { status: "pending", message: "网关或回调地址未填，需以 http(s):// 开头" }
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
    title: "管理员白名单",
    desc: "确认当前 open_id 在白名单内，用于登录校验与操作留痕。",
    kind: "auto",
    tab: "overview",
    check: async (cfg) => {
      await sleep(400)
      if (/^ou_[a-z0-9]{6,}$/.test(cfg.adminOpenId.trim())) {
        return { status: "done", message: "管理员 open_id 已确认并加入白名单" }
      }
      return { status: "pending", message: "open_id 格式不正确，应以 ou_ 开头" }
    },
  },
  {
    id: "verify",
    title: "连通性验证并完成",
    desc: "前置全部完成后，跑一次只读验证，通过即完成初始化。",
    kind: "auto",
    tab: "overview",
    check: async (cfg, marks) => {
      await sleep(700)
      const ready =
        /^cli_/.test(cfg.appId) &&
        cfg.baseToken.length >= 20 &&
        /^https?:\/\//.test(cfg.gatewayUrl) &&
        marks.publish &&
        marks.collaborator &&
        /^ou_/.test(cfg.adminOpenId)
      return ready
        ? { status: "done", message: "全链路验证通过，初始化完成" }
        : { status: "pending", message: "还有前置步骤未完成，请先逐项处理" }
    },
  },
]
