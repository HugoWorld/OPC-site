/* ------------------------------------------------------------------ */
/* 首页数据：Hero、数字条、价值主张、受众、区块编排。                    */
/* 与正式站 data/hero.yml、data/home.yml、data/value-props.yml 同源。   */
/* ------------------------------------------------------------------ */

import heroAvatar from "../assets/hero-avatar.webp"
import avatar224 from "../assets/hero-avatar-224.webp"
import avatar320 from "../assets/hero-avatar-320.webp"
import avatar448 from "../assets/hero-avatar-448.webp"
import heroBg from "../assets/hero-bg.webp"

/** 默认头像的三档尺寸（224 / 320 / 448），供 srcset 按 DPR 选择。 */
export const HERO_AVATAR_SRCSET = [
  `${avatar224} 224w`,
  `${avatar320} 320w`,
  `${avatar448} 448w`,
].join(", ")

export const HERO = {
  eyebrow: "法律与咨询服务一线出身 · 一人公司",
  title: "把专业服务里最重复的部分，做成能直接接手的交付流水线",
  lead: "合同审查、法规更新、案件流程、咨询交付——不卖流量，只交付能验收的服务工具与流程标准。",
  note: "我不承诺案件结果、胜诉率或咨询成效。专业意见的最终出具由执业人员复核确认。",
  /* ---- 人设区（游客动线第一屏）：头像、气泡、个人标签、GitHub ---- */
  bubble: "嗨，我是HugoW。把反复踩过的坑，做成能直接接手的工具。",
  tags: ["合同审查", "案件流程", "合规巡检", "一人公司"],
  githubUrl: "https://github.com/HugoWorld",
  githubLabel: "GitHub",
  /** 卡通拟人化头像（站内资源，空则改用主题占位字「H」） */
  avatarUrl: heroAvatar as string,
  /** 头像区背景图（站内资源，空则改用渐变玻璃底） */
  heroBgUrl: heroBg as string,
} as const

export interface Stat {
  value: string
  label: string
  note: string
}

/** 数字条：4 个，每个强制带口径说明（口径不写虚的）。 */
export const STATS: Stat[] = [
  { value: "10+", label: "类服务场景", note: "从合同、尽调到合规自检的服务流程" },
  { value: "7", label: "年在专业现场", note: "从接案、办理到交付复盘的全流程经历" },
  { value: "6", label: "条标准化流水线", note: "已固化为模板、清单与固定工序" },
  { value: "2", label: "条边界红线", note: "不承诺结果，不代出具执业文书" },
] as const

export const VALUE_PROPS = [
  {
    icon: "shield",
    title: "办过，不是听说过",
    desc: "我在专业服务一线做过完整案子与项目，知道哪一步最耗人、哪一步最容易出纰漏。",
  },
  {
    icon: "tools",
    title: "只交付能验收的东西",
    desc: "清单、模板、台账、流程手册——交付物清单与验收标准写在纸上，逐项可查。",
  },
  {
    icon: "chart",
    title: "不承诺做不到的事",
    desc: "案件结果、胜诉率、咨询成效不承诺，边界写在最前面。",
  },
  {
    icon: "clipboard",
    title: "交付流程已流水线化",
    desc: "模板、清单与固定工序，可复现、可接手，团队不再靠人肉。",
  },
  {
    icon: "sparkles",
    title: "一人公司，直接对结果负责",
    desc: "不转包、不层层转述，你直接对接干活的人。",
  },
] as const

export const AUDIENCES = [
  {
    name: "独立律师与小型律所",
    desc: "案件流程与文书模板要标准化，助理能直接上手。",
  },
  {
    name: "咨询公司与顾问团队",
    desc: "交付物要统一口径，报告与清单要能复用。",
  },
  {
    name: "企业法务部",
    desc: "合同审查与法规更新要有人盯，不能只靠人肉翻。",
  },
  {
    name: "同行的业务负责人",
    desc: "愿意把办案经验沉淀成工具，而不是只买一次服务。",
  },
] as const

/* ------------------------------------------------------------------ */
/* 首页 Hero 右侧：轮换演示卡（DemoCard）                                */
/* 想改演示内容只改这里：新增/删除一个对象，加一个 tab 就多一个场景。     */
/* 每个场景：                                                          */
/*   label        → 底部 tab 名                                         */
/*   windowTitle  → 卡片顶栏的窗口标题                                   */
/*   summary      → 底部统计行（如「共 27 条要求 · 已核对 24 条」）         */
/*   progress     → 进度百分比（0—100 整数）                              */
/*   rows         → 行内容（label 主行 / meta 定位行 / status 徽章文案）   */
/* ------------------------------------------------------------------ */
export interface DemoRow {
  label: string
  meta: string
  status: string
  variant?: "default" | "secondary" | "outline"
}

export interface DemoPanel {
  id: string
  label: string
  windowTitle: string
  summary: string
  progress: number
  rows: DemoRow[]
}

export const DEMOS: DemoPanel[] = [
  {
    id: "legal-review",
    label: "合同审查",
    windowTitle: "legal-review / 审查清单台账",
    summary: "本月 9 份合同 · 已审 7 份",
    progress: 82,
    rows: [
      { label: "框架协议 · 争议解决条款", meta: "审查清单第 4 项 · 已出意见", status: "已审", variant: "secondary" },
      { label: "采购合同 · 验收与付款", meta: "清单第 6 项 · 待客户确认", status: "待确认", variant: "default" },
      { label: "顾问服务协议 · 保密条款", meta: "本周新增 · 未开始", status: "待排期", variant: "outline" },
    ],
  },
  {
    id: "legal-case",
    label: "案件流程",
    windowTitle: "legal-case / 全周期节点台账",
    summary: "在办 6 件 · 本周节点 4 个",
    progress: 74,
    rows: [
      { label: "某合同争议 · 举证材料", meta: "节点 3 / 7 · 期限 5 天后", status: "进行中", variant: "default" },
      { label: "顾问服务项目 · 阶段报告", meta: "节点 4 / 6 · 已交付初稿", status: "待验收", variant: "secondary" },
      { label: "制度梳理 · 访谈纪要", meta: "节点 1 / 5 · 未开始", status: "待排期", variant: "outline" },
    ],
  },
  {
    id: "legal-compliance",
    label: "合规自检",
    windowTitle: "legal-compliance / 法规引用巡检",
    summary: "巡检 86 条引用 · 异常 5 条",
    progress: 100,
    rows: [
      { label: "《××管理办法》2021 版", meta: "2025-06 被替代 · 已标失效", status: "已失效", variant: "outline" },
      { label: "行业合规指引（现行）", meta: "引用 3 条已修订条款 · 需更新", status: "需修订", variant: "default" },
      { label: "内部合规清单 · 第 2 版", meta: "自检项 22 条 · 已勾选 19 条", status: "待补齐", variant: "secondary" },
    ],
  },
]

export const DEMO_INTERVAL_MS = 5000

/* ------------------------------------------------------------------ */
/* 产品演示视频：首页「产品与演示」区的视频卡。                          */
/* 默认空（原型无真实演示视频）；运营工作台「演示管理」页上传/维护。      */
/* videoUrl 支持可嵌入地址（如 .mp4 / bilibili 外链）或跳转页。         */
/* ------------------------------------------------------------------ */
export interface DemoVideo {
  id: string
  /** 关联产品名（展示用） */
  productName: string
  title: string
  desc: string
  coverUrl?: string
  videoUrl: string
  durationText?: string
  order: number
  published?: boolean
}

export const DEMO_VIDEOS: DemoVideo[] = []


/** 首页区块编排：改这里就改首页结构，不用碰页面组件。
 *  按游客兴趣动线：人设 → 数字 → 产品 → 演示 → 分享 → 价值 → 交付 → 大家评价 → 按主题找文章。 */
export const HOME_SECTIONS = [
  {
    key: "products",
    num: "01",
    title: "我的产品",
    lead: "我亲手做的、能直接上手的东西。点卡片看详情。",
    more: null,
  },
  {
    key: "demo",
    num: "02",
    title: "产品与演示",
    lead: "挑一个产品，看它跑起来的样子。",
    more: null,
  },
  {
    key: "shares",
    num: "03",
    title: "分享区",
    lead: "按主题分享我常用的开源项目、博主文章与顺手做的小工具。",
    more: null,
  },
  {
    key: "value_props",
    num: "04",
    title: "你为什么该找我",
    lead: "三句话，都是可以核对的。",
    more: null,
  },
  {
    key: "method",
    num: "05",
    title: "怎么交付",
    lead: "先说边界，再谈合作。",
    more: { label: "完整的交付流程与不承诺清单 →", href: "/method/" },
  },
  {
    key: "evidence",
    num: "06",
    title: "大家评价",
    lead: "服务过的客户怎么说，比自我介绍有用。",
    more: { label: "更多案例 →", href: "/cases/" },
  },
  {
    key: "writing",
    num: "07",
    title: "按主题找文章",
    lead: "方法、案例与踩过的坑，按主题快速查阅。",
    more: { label: "全部文章 →", href: "/writing/" },
  },
] as const

/* ------------------------------------------------------------------ */
/* 「我的产品」轮播设置：工作台「产品管理」可自定义轮播间隔（毫秒）。    */
/* ------------------------------------------------------------------ */
export interface ProductCarousel {
  /** 自动轮播间隔（毫秒；前台会夹在 2000—30000 之间） */
  intervalMs: number
}

export const PRODUCT_CAROUSEL: ProductCarousel = {
  intervalMs: 4000,
} as const

/* ------------------------------------------------------------------ */
/* 「大家评价」：客户评价（工作台「首页内容 → 大家评价」可自定义）。     */
/* ------------------------------------------------------------------ */
export interface Testimonial {
  id: string
  /** 客户原话（生动、可核对的口吻） */
  quote: string
  /** 客户称呼（可匿名：陈工 / 周经理） */
  author: string
  /** 身份 / 岗位说明 */
  role: string
  /** 关联的产品或项目 */
  project: string
  order: number
  /** false = 不展示（默认 true） */
  published?: boolean
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t-contract",
    quote: "以前审合同是三个人的经验活，现在清单摆在那，换谁审都是同一套口径，意见还能查到。",
    author: "陈律师",
    role: "小型律所 · 合伙人",
    project: "合同审查流水线",
    order: 1,
  },
  {
    id: "t-compliance",
    quote: "合规自检过去没人愿意碰，现在每个季度是团队主动来问我：这期该检哪些，还差谁没交。",
    author: "周经理",
    role: "企业法务部 · 合规负责人",
    project: "法规更新与合规自检",
    order: 2,
  },
  {
    id: "t-case",
    quote: "接进团队第一个月，新人上手速度比我们预想的快。节点写清楚了，大家就不再靠人肉记进度。",
    author: "何老师",
    role: "咨询公司 · 项目对接人",
    project: "案件流程管理",
    order: 3,
  },
]
