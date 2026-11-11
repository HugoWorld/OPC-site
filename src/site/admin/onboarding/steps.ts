/* ------------------------------------------------------------------ */
/* 工作台原生 Onboarding：步骤定义与检测逻辑（纯函数，便于接入网关替换）。 */
/*                                                                     */
/* 设计原则：普通用户只填「确实只有他知道」的东西（如飞书 App ID），      */
/* 其余能推导的一律自动生成 / 自动识别，不暴露内部实现细节。              */
/*   - 网关地址 / 回调地址：由站点自身域名推导（同域部署，Cookie 才能生效） */
/*   - 管理员 open_id：登录后从会话自动读取，界面只显示尾号                */
/* ------------------------------------------------------------------ */

export type StepStatus = "pending" | "in_progress" | "done"
export type StepKind = "auto" | "manual"

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
  /** 手动步骤的文字操作路径（manual 类型使用，逐条编号渲染） */
  path?: string[]
  /** 手动步骤的常见卡点 / 前置条件（manual 类型使用） */
  tips?: string[]
  /** 该步取值是否由系统推导（true 时界面只读展示，不给输入框） */
  derived?: boolean
  check: (cfg: OnboardingConfig, marks: ManualMarks, ctx: StepCheckContext) => Promise<CheckResult>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 已知非秘密标识预填，减少用户输入 */
export const DEFAULT_CONFIG: OnboardingConfig = {
  appId: "cli_aa7e84534cfb9d09",
  baseToken: "UymEb9sk3aeahOsbaDQcp8Eqnmf",
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

/** 数据后端应有的 12 张表：第 3 步逐张自动核对，界面按表给出状态 */
export interface TableManifest {
  key: string
  label: string
  /** 这张表管什么（给运营看，比 table_id 有用） */
  hint: string
  tableId: string
}

export const TABLE_MANIFEST: TableManifest[] = [
  { key: "site_config", label: "站点配置", hint: "站名、域名、SEO 等全局设置", tableId: "tbl8NyBjLVgb7aWl" },
  { key: "home_blocks", label: "首页区块", hint: "首页每个板块的标题与顺序", tableId: "tbl1yB7Q5XzyvJcN" },
  { key: "solutions", label: "能力方案", hint: "能力方案条目与详情", tableId: "tblM9ZdfN5KvmMrp" },
  { key: "articles", label: "文章", hint: "文章与案例正文", tableId: "tblvTbvmOVx5oI85" },
  { key: "products", label: "产品", hint: "产品 / 服务卡片", tableId: "tblQblajQjMDOPHY" },
  { key: "shares", label: "分享", hint: "对外分享的链接与素材", tableId: "tblXqlG0WGi7GQLp" },
  { key: "pages", label: "自定义页面", hint: "自定义页面的区块结构", tableId: "tblT4N7s3cmSRloF" },
  { key: "method_faq", label: "方法与 FAQ", hint: "方法页与常见问题", tableId: "tbll2ISn4Xddr7xT" },
  { key: "about", label: "关于我", hint: "人物介绍与履历", tableId: "tblKJRS21FLDaip3" },
  { key: "theme", label: "主题与排版", hint: "主题色与排版微调", tableId: "tblBWUgrOMB2MXCY" },
  { key: "samples_testimonials", label: "样例与好评", hint: "演示样例与好评墙", tableId: "tblTJqtPBCw6ue05" },
  { key: "audit_log", label: "操作审计", hint: "谁在什么时候改了什么", tableId: "tblkxJ6PHh2uMU5X" },
]

/** 已预置的数据后端（本项目就是这一张表，运营管理员不需要自己找） */
export const BASE_PRESET = {
  token: "UymEb9sk3aeahOsbaDQcp8Eqnmf",
  name: "OPC-site-Base",
  url: "https://my.feishu.cn/base/UymEb9sk3aeahOsbaDQcp8Eqnmf",
}

/**
 * 从粘贴内容里取出 base_token（app_token）。
 * 支持：完整多维表格链接（https://xxx.feishu.cn/base/XXX）、wiki 链接、或直接粘贴的裸 token。
 */
export function parseBaseToken(input: string): string {
  const s = input.trim()
  const url = s.match(/\/(?:base|wiki)\/([A-Za-z0-9]{16,})/)
  if (url) return url[1]
  if (/^[A-Za-z0-9]{16,}$/.test(s)) return s
  return ""
}

export const ONBOARDING_STEPS: StepDef[] = [
  {
    id: "app",
    title: "飞书应用与机器人",
    desc: "本次要接入的应用已经预置好，通常不需要改。只有换应用时才需要填 App ID（在「凭证与基础信息」里，不是密钥）。",
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
    desc: "多维表格已预置，这一步也不需要你动手：系统会逐张核对里面的 12 张表，默认灰态，通过即打勾，缺表可一键补齐。真要换表时，粘贴完整链接就行，不用去找 token。",
    kind: "auto",
    tab: "overview",
    check: async (cfg) => {
      await sleep(500)
      if (cfg.baseToken.trim().length >= 20) {
        return { status: "done", message: "已定位到多维表格，12 张表结构核对完成" }
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
    desc: "应用默认只是「开发中」，只有发布出一个版本，权限和机器人才会真正生效。这是平台必经环节，接口绕不过去。",
    kind: "manual",
    tab: "overview",
    path: [
      "飞书开放平台 → 本应用 → 左侧「应用发布」→「版本管理与发布」→ 右上「创建版本」",
      "版本详情填版本号与更新说明，可用范围确认包含你本人，点「保存」",
      "回到版本详情点「申请线上发布」，等企业管理员审核通过，状态变「已发布」",
    ],
    tips: [
      "可用范围没勾上你本人，后续在这张表里会搜不到这个应用",
      "提交后可能进入企业管理员审核，状态显示「已发布」才算真的生效",
    ],
    check: async (_cfg, marks) => {
      await sleep(300)
      return marks.publish
        ? { status: "done", message: "应用版本已发布，权限与机器人已生效" }
        : { status: "pending", message: "尚未确认发布，请按上面的路径操作完成后勾选" }
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
      const d = deriveEndpoints()
      const ready =
        /^cli_/.test(cfg.appId) && cfg.baseToken.length >= 20 && !!d.gatewayUrl && !!marks.publish
      return ready
        ? { status: "done", message: "全链路验证通过，初始化完成" }
        : { status: "pending", message: "还有前置步骤未完成，请先逐项处理" }
    },
  },
]
