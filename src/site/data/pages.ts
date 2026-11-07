/* ------------------------------------------------------------------ */
/* 通用化：页面注册表 + 区块类型系统。                                    */
/* 每个自定义二级页面 = slug + 标题 + 一组区块（顺序即渲染顺序）。        */
/* 区块为判别联合（type 决定渲染器与编辑器形态），支持工作台增删排序、   */
/* 模板生成与 JSON 导入（生成物即区块数组，进入草稿层后走预览→发布）。    */
/* ------------------------------------------------------------------ */

/* ---------------- 区块类型（判别联合） ---------------- */

/** 区块公共字段：唯一 id + 渲染类型 */
export interface BlockBase {
  id: string
  type: BlockType
}

export type BlockType =
  | "hero"
  | "stats"
  | "cards"
  | "text"
  | "faq"
  | "timeline"
  | "cta"
  | "columns"
  | "gallery"
  | "pricing"
  | "testimonials"

/** hero：页面首屏大标题区 */
export interface HeroBlock extends BlockBase {
  type: "hero"
  eyebrow?: string
  title: string
  lead: string
  note?: string
  ctaText?: string
  ctaHref?: string
}

/** stats：数字条（可核对口径） */
export interface StatsBlock extends BlockBase {
  type: "stats"
  items: { value: string; label: string; note?: string }[]
}

/** cards：卡片网格（适合服务/模块/卖点） */
export interface CardsBlock extends BlockBase {
  type: "cards"
  title?: string
  subtitle?: string
  items: { title: string; desc: string; tag?: string; href?: string }[]
}

/** text：富文本段落（title + body，body 支持 \n 分段） */
export interface TextBlock extends BlockBase {
  type: "text"
  title?: string
  body: string
}

/** faq：分组问答 */
export interface FaqBlock extends BlockBase {
  type: "faq"
  title?: string
  groups: { question: string; answer: string }[]
}

/** timeline：时间线（适合履历/里程碑/流程） */
export interface TimelineBlock extends BlockBase {
  type: "timeline"
  title?: string
  items: { time: string; title: string; desc?: string }[]
}

/** cta：行动号召横幅 */
export interface CtaBlock extends BlockBase {
  type: "cta"
  title: string
  subtitle?: string
  buttonText?: string
  buttonHref?: string
}

/** columns：多栏并列（适合价值观/原则/差异点） */
export interface ColumnsBlock extends BlockBase {
  type: "columns"
  title?: string
  columns: { title: string; desc: string }[]
}

/** gallery：图片网格（原型占位，用标题色块代替真实图） */
export interface GalleryBlock extends BlockBase {
  type: "gallery"
  title?: string
  items: { title: string; desc?: string }[]
}

/** pricing：价格/套餐（可选推荐标记） */
export interface PricingBlock extends BlockBase {
  type: "pricing"
  title?: string
  subtitle?: string
  plans: { name: string; price: string; period?: string; desc?: string; features: string[]; featured?: boolean; ctaText?: string; ctaHref?: string }[]
}

/** testimonials：用户好评/客户证言墙 */
export interface TestimonialsBlock extends BlockBase {
  type: "testimonials"
  title?: string
  subtitle?: string
  items: { quote: string; name: string; role?: string }[]
}

export type PageBlock =
  | HeroBlock
  | StatsBlock
  | CardsBlock
  | TextBlock
  | FaqBlock
  | TimelineBlock
  | CtaBlock
  | ColumnsBlock
  | GalleryBlock
  | PricingBlock
  | TestimonialsBlock

/* ---------------- 页面定义 ---------------- */

export interface CustomPage {
  /** 唯一 slug，路由 /pages/:slug/ */
  slug: string
  /** 页面标题（导航/文档标题） */
  title: string
  /** 可选：是否出现在主导航（不设置则不显示） */
  inNav?: boolean
  /** 区块列表（顺序即渲染顺序） */
  blocks: PageBlock[]
  /** 来源标注：builtin / template / ai / imported */
  origin?: "builtin" | "template" | "ai" | "imported"
}

/* ---------------- 区块种子（新建/模板/AI 共用） ---------------- */

let seedSeq = 0
export function newBlockId(prefix: string) {
  seedSeq += 1
  return `${prefix}-${Date.now().toString(36)}-${seedSeq}`
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  hero: "首屏 Hero",
  stats: "数字条",
  cards: "卡片网格",
  text: "图文段落",
  faq: "分组问答",
  timeline: "时间线",
  cta: "行动号召",
  columns: "多栏并列",
  gallery: "图片网格",
  pricing: "价格套餐",
  testimonials: "用户好评",
}

/** 生成一个指定类型的空区块（原型默认值，可编辑）。 */
export function createBlock(type: BlockType): PageBlock {
  const id = newBlockId(type)
  switch (type) {
    case "hero":
      return { id, type, eyebrow: "", title: "页面主标题", lead: "导语：一句话说明这一页解决什么问题。", note: "", ctaText: "", ctaHref: "" }
    case "stats":
      return { id, type, items: [{ value: "12+", label: "交付场景", note: "口径说明（可核对）" }] }
    case "cards":
      return {
        id,
        type,
        title: "模块标题",
        subtitle: "一句话说明",
        items: [
          { title: "第一项", desc: "这一项做什么、交付什么。", tag: "" },
          { title: "第二项", desc: "这一项做什么、交付什么。", tag: "" },
        ],
      }
    case "text":
      return { id, type, title: "小节标题", body: "第一段内容。\n\n第二段内容。" }
    case "faq":
      return { id, type, title: "常见问题", groups: [{ question: "问题一", answer: "回答一" }] }
    case "timeline":
      return {
        id,
        type,
        title: "时间线",
        items: [
          { time: "2024", title: "起点", desc: "做了什么" },
          { time: "2025", title: "进展", desc: "做到了什么" },
        ],
      }
    case "cta":
      return { id, type, title: "想进一步了解？", subtitle: "", buttonText: "联系我", buttonHref: "/contact/" }
    case "columns":
      return {
        id,
        type,
        title: "并列要点",
        columns: [
          { title: "第一点", desc: "说明。" },
          { title: "第二点", desc: "说明。" },
          { title: "第三点", desc: "说明。" },
        ],
      }
    case "gallery":
      return {
        id,
        type,
        title: "图片网格",
        items: [
          { title: "图一", desc: "" },
          { title: "图二", desc: "" },
        ],
      }
    case "pricing":
      return {
        id,
        type,
        title: "价格与套餐",
        subtitle: "按需选用，不捆绑",
        plans: [
          { name: "基础版", price: "¥0", period: "体验", desc: "先跑通核心流程。", features: ["核心功能", "社区支持"], ctaText: "开始使用", ctaHref: "/contact/" },
          { name: "专业版", price: "¥999", period: "/ 月起", desc: "适合正式使用。", features: ["全部功能", "优先支持", "数据归属你方"], featured: true, ctaText: "预约演示", ctaHref: "/contact/" },
        ],
      }
    case "testimonials":
      return {
        id,
        type,
        title: "大家怎么说",
        subtitle: "来自真实使用者的反馈",
        items: [
          { quote: "「把重复步骤固化成流程后，交付明显更快了。」", name: "某律所负责人", role: "专业服务" },
          { quote: "「边界写得很清楚，合作前就知道交付什么。」", name: "某合作方", role: "IT 服务" },
        ],
      }
  }
}

/* ---------------- 默认页面（builtin 示例） ---------------- */

/**
 * 默认注册一个「服务清单」示例动态页：展示区块化渲染效果。
 * 运营可在工作台「页面管理」里删改，也可通过模板/AI 新建更多页面。
 */
export const DEFAULT_PAGES: CustomPage[] = [
  {
    slug: "services",
    title: "服务清单",
    /** 不进主导航：服务清单模块已按需求移除，页面保留仅供工作台页面管理演示 */
    inNav: false,
    origin: "builtin",
    blocks: [
      {
        id: "p-services-hero",
        type: "hero",
        eyebrow: "能提供什么",
        title: "一套能直接接手的交付流水线",
        lead: "按模块交付：每个模块都有交付物清单与明确边界，先看边界，再谈合作。",
        note: "不承诺案件结果、胜诉率或咨询成效，最终专业意见由执业人员复核确认。",
        ctaText: "看看怎么做",
        ctaHref: "/method/",
      },
      {
        id: "p-services-cards",
        type: "cards",
        title: "核心模块",
        subtitle: "每个模块都是一条独立交付的流水线",
        items: [
          { title: "合同审查流水线", desc: "合同 → 可勾选的审查清单、意见书与审查台账。", tag: "主推", href: "/solutions/legal-contract-flow/" },
          { title: "案件流程管理", desc: "接案到结案 → 有节点、有留痕的流程 SOP 与案件台账。", tag: "", href: "/solutions/legal-case-sop/" },
          { title: "法规更新与合规自检", desc: "法规变更定时巡检 → 可勾选的合规自检清单。", tag: "", href: "/solutions/legal-compliance-watch/" },
        ],
      },
      {
        id: "p-services-stats",
        type: "stats",
        items: [
          { value: "10+", label: "类服务场景", note: "从合同、尽调到合规自检" },
          { value: "7", label: "年在专业现场", note: "从接案、办理到交付复盘" },
          { value: "6", label: "条标准化流水线", note: "模板、清单与固定工序" },
        ],
      },
      {
        id: "p-services-faq",
        type: "faq",
        title: "常见问题",
        groups: [
          { question: "可以只买一个模块吗？", answer: "可以。每个模块独立交付，按模块报价，先小范围跑通再扩展。" },
          { question: "交付物是什么形式？", answer: "可复用的清单、模板、台账与文档，附使用说明与培训。" },
          { question: "有什么不做的？", answer: "不承诺案件结果、胜诉率或咨询成效；不代出具执业文书；不接涉密项目。" },
        ],
      },
      {
        id: "p-services-cta",
        type: "cta",
        title: "想先看边界再谈合作？",
        subtitle: "15 分钟演示，用你的脱敏资料现场跑。",
        buttonText: "预约一次演示",
        buttonHref: "/contact/",
      },
    ],
  },
]

/* ---------------- 模板库（M2：首页模板 / 行业模板） ---------------- */

export interface PageTemplate {
  id: string
  name: string
  /** 适用行业/场景描述（AI 匹配关键词用） */
  keywords: string[]
  desc: string
  page: CustomPage
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "tpl-saas",
    name: "SaaS 产品首页",
    keywords: ["saas", "软件", "产品", "工具", "平台", "互联网", "app"],
    desc: "Hero + 功能卡片 + 数字 + FAQ，适合软件/工具产品介绍页。",
    page: {
      slug: "product",
      title: "产品",
      inNav: true,
      origin: "template",
      blocks: [
        { id: "t-saas-1", type: "hero", eyebrow: "产品", title: "把重复工作交给系统", lead: "面向团队的一款工具，覆盖从输入到交付的完整链路。", note: "可先免费试用核心模块。", ctaText: "预约演示", ctaHref: "/contact/" },
        {
          id: "t-saas-2",
          type: "cards",
          title: "核心能力",
          subtitle: "按需选用，按模块计价",
          items: [
            { title: "自动化流水线", desc: "把人工步骤固化为模板、脚本与工序，可追溯可复用。", tag: "" },
            { title: "知识底座", desc: "领域本体统一口径，更新一次全链路生效。", tag: "" },
            { title: "一致性校验", desc: "同一项目、同一份报告前后是否打架，自动检查。", tag: "" },
          ],
        },
        { id: "t-saas-3", type: "stats", items: [{ value: "60%", label: "重复工作减少", note: "典型场景自测" }, { value: "24h", label: "新规入库速度", note: "订阅式更新" }] },
        { id: "t-saas-4", type: "faq", title: "常见问题", groups: [{ question: "需要部署吗？", answer: "不需要，网页端直接使用；数据归你方所有。" }, { question: "可以按模块买吗？", answer: "可以，先小范围跑通再扩展。" }] },
      ],
    },
  },
  {
    id: "tpl-consulting",
    name: "咨询服务页",
    keywords: ["咨询", "顾问", "服务", "培训", "外包", "b端", "专业服务"],
    desc: "Hero + 服务方式 + 时间线 + FAQ，适合专业咨询服务介绍。",
    page: {
      slug: "consulting",
      title: "咨询服务",
      inNav: true,
      origin: "template",
      blocks: [
        { id: "t-cons-1", type: "hero", eyebrow: "咨询服务", title: "先看边界，再谈合作", lead: "按问题交付，不按人头计费；交付物与验收标准写进协议。", note: "不承诺无法验收的结果。", ctaText: "聊聊你的问题", ctaHref: "/contact/" },
        {
          id: "t-cons-2",
          type: "columns",
          title: "怎么合作",
          columns: [
            { title: "诊断", desc: "先花一次时间把问题讲清楚，输出建议与报价。" },
            { title: "交付", desc: "按里程碑交付，每个节点都可验收、可回退。" },
            { title: "维护", desc: "交付后一段时间的答疑与更新，边界写在协议里。" },
          ],
        },
        { id: "t-cons-3", type: "timeline", title: "典型节奏", items: [{ time: "第 1 周", title: "对齐问题", desc: "需求澄清 + 范围确认" }, { time: "第 2-4 周", title: "交付核心", desc: "按里程碑交付，周例会同步" }, { time: "第 5 周起", title: "验收与答疑", desc: "验收清单逐项核对" }] },
        { id: "t-cons-4", type: "faq", title: "常见问题", groups: [{ question: "异地可以合作吗？", answer: "可以，线上同步 + 定期线下。" }, { question: "报价怎么定？", answer: "按问题复杂度与周期报价，先诊断后报价。" }] },
      ],
    },
  },
  {
    id: "tpl-studio",
    name: "工作室/个人品牌页",
    keywords: ["工作室", "个人", "品牌", "设计", "创作", "独立"],
    desc: "Hero + 代表作品 + 数字 + CTA，适合个人/小团队作品集。",
    page: {
      slug: "works",
      title: "作品",
      inNav: true,
      origin: "template",
      blocks: [
        { id: "t-stu-1", type: "hero", eyebrow: "独立工作室", title: "做能拿得出手的作品", lead: "不追求数量，交付的每件东西都经得起复核。", ctaText: "看作品", ctaHref: "#works" },
        { id: "t-stu-2", type: "gallery", title: "代表作品", items: [{ title: "作品一", desc: "一句话说明" }, { title: "作品二", desc: "一句话说明" }, { title: "作品三", desc: "一句话说明" }] },
        { id: "t-stu-3", type: "stats", items: [{ value: "30+", label: "已完成项目", note: "" }, { value: "5", label: "长期客户", note: "" }] },
        { id: "t-stu-4", type: "cta", title: "想聊聊你的项目？", buttonText: "写封邮件", buttonHref: "/contact/" },
      ],
    },
  },
]

/** 从关键词匹配一个模板（预留：将来若做独立的「AI 生成」栏目再接回）。 */
export function matchTemplate(keywords: string): PageTemplate | undefined {
  const k = keywords.toLowerCase()
  return PAGE_TEMPLATES.find((t) => t.keywords.some((w) => k.includes(w)))
}

/* ---------------- 模板/导入校验 ---------------- */

export const BLOCK_TYPES: BlockType[] = [
  "hero",
  "stats",
  "cards",
  "text",
  "faq",
  "timeline",
  "cta",
  "columns",
  "gallery",
  "pricing",
  "testimonials",
]

/** 校验导入的页面 JSON，返回错误信息（无错误返回 null）。 */
export function validatePageImport(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "必须是 JSON 对象（页面定义）"
  const o = raw as Record<string, unknown>
  if (typeof o.slug !== "string" || !/^[a-z0-9-]+$/.test(o.slug)) return "slug 必须为小写字母/数字/中划线（如 my-page）"
  if (typeof o.title !== "string" || !o.title.trim()) return "title（页面标题）不能为空"
  if (!Array.isArray(o.blocks) || o.blocks.length === 0) return "blocks（区块列表）不能为空"
  const ids = new Set<string>()
  for (const b of o.blocks) {
    if (typeof b !== "object" || b === null) return "每个区块必须是对象"
    const bl = b as Record<string, unknown>
    if (typeof bl.id !== "string" || !bl.id.trim()) return "每个区块需要唯一 id（字符串）"
    if (ids.has(bl.id)) return `区块 id 重复：${bl.id}`
    ids.add(bl.id)
    if (!BLOCK_TYPES.includes(bl.type as BlockType)) return `不支持的区块类型：${String(bl.type)}`
  }
  return null
}

/** 把导入 JSON 归一化为 CustomPage（校验通过后）。 */
export function normalizePageImport(raw: Record<string, unknown>): CustomPage {
  return raw as unknown as CustomPage
}
