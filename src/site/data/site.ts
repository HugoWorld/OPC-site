/* ------------------------------------------------------------------ */
/* 站点全局数据：品牌、导航、页脚、联系。                                */
/* 与正式站 site.config.json / data/*.yml 同源，改这里即改全站。        */
/* ------------------------------------------------------------------ */

export const SITE = {
  brandName: "洛小山",
  brandShort: "洛",
  tagline: "法律与咨询服务交付",
  locale: "zh-CN",
  author: "洛小山",
  company: "个人独立经营",
  icoNote: "",
  /** 品牌名（占位）。形象与实名确认后替换，全站自动生效。 */
  mascotAlt: "洛小山 拟卡通形象（占位）",
  email: "hello@luoxiaoshan.example",
  emailHref: "mailto:hello@luoxiaoshan.example",
  wechatNote: "加微信请备注「来意 + 所在行业 + 所在城市」",
  responseTime: "1—3 个工作日",
  demoDuration: "15 分钟，用你的脱敏资料现场跑",
} as const

export const NAV = [
  { label: "能做什么", href: "/solutions/" },
  { label: "怎么交付", href: "/method/" },
  { label: "大家评价", href: "/cases/" },
  { label: "我在写", href: "/writing/" },
  { label: "关于我", href: "/about/" },
] as const

export const CTA = {
  label: "预约一次演示",
  href: "/contact/",
  /** 首页「联系一下」右侧拟人卡通图 URL（空 = 用首页头像图） */
  contactImageUrl: "",
  /** 自定义联系方式（label + 内容；右侧底部一行副信息展示，发布前替换为真实信息） */
  contactItems: [
    { label: "微信", value: "luoxiaoshan（示例）" },
    { label: "邮箱", value: "hello@luoxiaoshan.example" },
    { label: "坐标", value: "广州 · 法律与咨询服务交付" },
  ],
  /** 首页「联系一下」右侧：个人微信二维码（工作台可上传或粘贴链接，空 = 前台显示占位卡） */
  wechatQrUrl: "",
  /** 二维码下方说明 */
  wechatQrCaption: "微信扫码加我，备注「来意 + 所在行业 + 所在城市」",
  /** 联系页「关注我」引流区：公众号二维码（主位）+ 平台账号行（次位，不抢预约主行动） */
  follow: {
    /** 公众号二维码图片 URL（空 = 前台显示占位卡，工作台可上传替换） */
    qrUrl: "",
    /** 二维码旁说明文字 */
    qrCaption: "扫码关注公众号，看我在做的项目复盘",
    /** 其他平台账号（label + 链接；链接为空时前台显示「即将上线」占位） */
    platforms: [
      { label: "小红书", url: "" },
      { label: "bilibili", url: "" },
    ],
  },
} as const

export const FOOTER_BOUNDARY =
  "本站内容与数据均可核对，合作前请以正式协议为准。本站为个人独立经营，与任何雇佣关系无关。"

export const FOOTER_AIGC =
  "本站部分文字与视觉素材由 AI 辅助生成，已按《人工智能生成合成内容标识办法》做标识。"

export const FOOTER_COLUMNS = [
  {
    title: "能做什么",
    links: [
      { label: "全部模块", href: "/solutions/" },
      { label: "合同审查流水线", href: "/solutions/legal-contract-flow/" },
      { label: "案件流程管理", href: "/solutions/legal-case-sop/" },
      { label: "法规更新与合规自检", href: "/solutions/legal-compliance-watch/" },
    ],
  },
  {
    title: "在写什么",
    links: [
      { label: "全部文章", href: "/writing/" },
      { label: "案例复盘", href: "/writing/case/" },
      { label: "行业观察", href: "/writing/insight/" },
      { label: "上手指南", href: "/writing/guide/" },
    ],
  },
  {
    title: "联系",
    links: [
      { label: "预约一次演示", href: "/contact/" },
      { label: "怎么交付", href: "/method/" },
      { label: "关于我", href: "/about/" },
      { label: "隐私政策", href: "/privacy/" },
    ],
  },
] as const

/** 文章分类显示名：从读者视角命名——读者点进来想知道「能看到什么」 */
export const CATEGORY_LABELS: Record<string, string> = {
  case: "真实案例",
  insight: "行业判断",
  guide: "上手方法",
}

/** 联系 / 预约落地页内容（个人 IP 站唯一联系页；缺省回退本默认文案，工作台可覆盖） */
export interface ContactContent {
  /** 页面大标题 */
  heading: string
  /** 标题下说明段 */
  lead: string
  /** 「想解决的环节」标签 */
  moduleLabel: string
  /** 部分 toB 色彩较重的表单字段标签（缺省用默认文案） */
  formLabels?: {
    company?: string
    team?: string
    when?: string
    source?: string
    detail?: string
    detailPlaceholder?: string
  }
  /** 侧边栏标题 */
  sidebarTitle: string
  /** 侧边栏说明 */
  sidebarNote: string
  /** 侧边栏键值列表（覆盖默认的 邮箱 / 响应时间 / 演示时长 三行） */
  sidebarMeta: { label: string; value: string }[]
  /** 侧边栏底部兜底说明 */
  asideHint: string
  /** 表单提交按钮文案 */
  submitText: string
  /** 提交成功态标题 */
  successTitle: string
  /** 提交成功态说明 */
  successNote: string
  /** 成功态「再填一次」文案 */
  resubmitText: string
}

export const DEFAULT_CONTACT: ContactContent = {
  heading: "预约一次演示",
  lead: "先聊场景，再看演示。填完我会在 1—3 个工作日内回复，附一份针对你情况的建议。",
  moduleLabel: "想解决的环节",
  formLabels: {
    company: "公司 / 机构名称",
    team: "团队规模",
    when: "期望启动时间",
    source: "你是从哪里知道我的",
    detail: "现在这件事是怎么做的",
    detailPlaceholder: "谁在做、每天做多久、最常出错的地方",
  },
  sidebarTitle: "也可以直接找我",
  sidebarNote: "加微信请备注「来意 + 所在行业 + 所在城市」，我会回得更快。",
  sidebarMeta: [
    { label: "邮箱", value: "hello@luoxiaoshan.example" },
    { label: "响应时间", value: "1—3 个工作日" },
    { label: "演示时长", value: "15 分钟，用你的脱敏资料现场跑" },
  ],
  asideHint: "不想填表单？直接说三件事：你们做什么、哪一步最耗人、期望什么时候启动。剩下的我来判断能不能接。",
  submitText: "提交",
  successTitle: "已收到，我会尽快回复",
  successNote:
    "表单已提交（原型演示）。正式版接入后，你会收到一封确认邮件；如果 3 个工作日没动静，直接加微信更快。",
  resubmitText: "再填一次",
}

/* ---------------- 二级页页面设置 ---------------- */

/** 每个二级页的标题与导语（工作台「站点信息 → 二级页页面设置」可改；缺省回退本默认文案）。 */
export interface PageSetting {
  title: string
  lead: string
}

export const PAGE_SETTINGS = {
  solutions: {
    title: "能做什么",
    lead: "每个模块都是一条独立交付的流水线：有交付物清单、有演示信息、也有明确的边界。可以只挑一个用。",
  },
  /** lead 为空时页面回退 method 切片导语（工作台「方法与 FAQ」管理） */
  method: {
    title: "怎么交付",
    lead: "",
  },
  cases: {
    title: "大家评价",
    lead: "服务过的客户怎么说，比自我介绍有用。所有案例均脱敏，授权范围写在案例底部。",
  },
  writing: {
    title: "我在写",
    lead: "方法论、案例复盘与行业观察。写给同行与潜在客户的信任素材：搜到你名字时，能看到的都是可核对的东西。",
  },
  shares: {
    title: "分享区",
    lead: "按主题分享我常用的开源项目、头部博主的文章，以及顺手做的小工具。",
  },
  /** lead 为空时页面回退 about 切片导语（工作台「关于我」管理） */
  about: {
    title: "关于我",
    lead: "",
  },
} as const
