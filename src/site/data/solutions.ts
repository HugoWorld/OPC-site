/* ------------------------------------------------------------------ */
/* 能力模块数据：与正式站 content/solutions/*.md 同源。                 */
/* 新增模块 = 在这里加一项，索引页与首页卡片自动出现。                   */
/* ------------------------------------------------------------------ */

export interface Solution {
  id: string
  title: string
  subtitle: string
  tier: "主推" | "扩展" | "引流"
  audience: string
  problem: string
  capabilities: string[]
  deliverables: string[]
  /** 使用后的正向变化（营销页展示，替代“不做什么”式边界说明） */
  outcomes?: string[]
  boundaries: string[]
  stack: string[]
  demo: { status: "可演示" | "待建"; duration: string; note: string }
  proof: { title: string; note: string }[]
  order: number
  /** 详情页正文（Markdown 简化为段落结构） */
  body: { heading: string; paragraphs: string[]; table?: string[][] }[]
  /** 运营工作台可控制：false = 不展示（默认 true） */
  published?: boolean
}

/** 线上快照可能还没同步 outcomes 字段；按 id 回退，保证营销页始终有正向卖点。 */
export const SOLUTION_OUTCOME_FALLBACK: Record<string, string[]> = {
  "legal-contract-flow": [
    "审查标准从个人经验变成团队清单",
    "每份合同改了什么、为什么改，都能追溯",
    "新人按清单上手，少反复问人",
  ],
  "legal-case-sop": [
    "案件进度一屏可见，不用翻聊天记录",
    "节点材料按清单归位，交接不丢",
    "客户同步有固定节奏与口径",
  ],
  "legal-compliance-watch": [
    "法规变化有固定巡检节奏",
    "失效引用在检查前暴露",
    "季度复盘有记录可查",
  ],
}

export const SOLUTIONS: Solution[] = [
  {
    id: "legal-contract-flow",
    title: "合同审查流水线",
    subtitle: "把一份合同要审的点，做成可勾选的审查清单与台账",
    tier: "主推",
    audience: "企业法务 · 独立律师",
    problem:
      "合同审查靠个人经验：审到什么程度全看承办人今天的状态。审完没有留痕，改了什么、为什么改，复盘时全靠回忆。",
    capabilities: [
      "按合同类型拆出审查要点清单（主体 / 价款 / 违约 / 争议解决等）",
      "生成审查意见书模板与批注规范",
      "搭建审查台账：每份合同的版本、意见、定稿留档",
      "沉淀常见条款库：高频条款的审法与修改建议",
    ],
    deliverables: [
      "审查清单库 + 意见书模板",
      "合同审查台账与版本管理规范",
      "一次 2 小时的使用培训 + 30 天答疑",
    ],
    outcomes: SOLUTION_OUTCOME_FALLBACK["legal-contract-flow"],
    boundaries: [
      "不构成法律意见，最终意见由执业律师出具",
      "不承诺审查结果或风险消除",
      "不处理涉密材料",
    ],
    stack: ["飞书文档", "模板库", "AI 辅助阅读"],
    demo: { status: "可演示", duration: "15 分钟", note: "带一份脱敏合同，现场跑出审查清单与意见书框架" },
    proof: [],
    order: 1,
    body: [
      {
        heading: "审查是可以被检查的",
        paragraphs: [
          "清单让「审了什么」可核验，台账让「改了什么」可追溯。承办人换人，审查标准不换。",
        ],
      },
    ],
  },
  {
    id: "legal-case-sop",
    title: "案件流程管理",
    subtitle: "把接案到结案的动作，做成有节点、有留痕的流程 SOP",
    tier: "扩展",
    audience: "律所团队 · 咨询项目组",
    problem:
      "案件进度在承办人脑子里，期限靠日历提醒，节点材料散在各处。客户一问进度，先要去翻聊天记录。",
    capabilities: [
      "拆解案件全周期节点：接案 / 立案 / 取证 / 开庭 / 结案",
      "生成每个节点的动作清单与材料清单",
      "搭建案件台账：期限、进度、关键材料统一留档",
      "生成客户进度同步模板：固定节奏、固定口径",
    ],
    deliverables: [
      "案件流程 SOP + 节点材料清单",
      "案件台账与进度同步模板",
      "一次 2 小时的使用培训 + 30 天答疑",
    ],
    outcomes: SOLUTION_OUTCOME_FALLBACK["legal-case-sop"],
    boundaries: [
      "不承诺案件结果或胜诉率",
      "流程与文书由执业人员审定后使用",
      "不替代法院 / 仲裁机构程序",
    ],
    stack: ["飞书多维表格", "案件台账", "AI 文书辅助"],
    demo: { status: "可演示", duration: "15 分钟", note: "用一个脱敏案件，现场搭出节点清单与台账" },
    proof: [],
    order: 2,
    body: [
      {
        heading: "让进度可被看见",
        paragraphs: [
          "节点清单让团队知道该做什么，台账让进度可被检查，客户同步让服务可被感知。三者合起来，才是一个可交付的服务。",
        ],
      },
    ],
  },
  {
    id: "legal-compliance-watch",
    title: "法规更新与合规自检",
    subtitle: "定时盯法规变更，把合规自检做成可勾选的清单",
    tier: "扩展",
    audience: "企业法务 · 合规团队",
    problem:
      "法规每年都在变，合规要求散在各处。等出问题时才发现引用的还是旧版，代价往往是一次检查、一次返工，或者一次不必要的争议。",
    capabilities: [
      "定时巡检法规与内部制度的引用，标出已废止 / 已修订条款",
      "生成合规自检清单：按业务场景逐项勾选",
      "沉淀合规台账：检查记录与整改留档",
      "输出季度复盘：哪些项反复不合格、该怎么改",
    ],
    deliverables: [
      "法规清单 + 巡检规则",
      "合规自检清单与台账模板",
      "一次 2 小时的使用培训 + 30 天答疑",
    ],
    outcomes: SOLUTION_OUTCOME_FALLBACK["legal-compliance-watch"],
    boundaries: [
      "巡检结果不构成合规结论，最终判断由专业人员出具",
      "不承诺处罚风险的消除",
      "不做监管沟通与代理申报",
    ],
    stack: ["巡检流水线", "知识库", "AI 对比"],
    demo: { status: "可演示", duration: "15 分钟", note: "用你的业务清单，现场跑一次法规引用巡检" },
    proof: [],
    order: 3,
    body: [
      {
        heading: "盯住变化，而不是赌运气",
        paragraphs: [
          "把「谁在什么时候检查什么」写成规则，让法规变更从「靠人发现」变成「靠系统提醒」。",
        ],
      },
    ],
  },
]

/** 按 order 排序后导出 */
export const SOLUTIONS_SORTED = [...SOLUTIONS].sort((a, b) => a.order - b.order)

export function getSolution(id: string) {
  return SOLUTIONS.find((s) => s.id === id)
}

export const TIER_STYLE: Record<Solution["tier"], string> = {
  主推: "default",
  扩展: "secondary",
  引流: "outline",
}
