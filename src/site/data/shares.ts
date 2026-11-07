/* ------------------------------------------------------------------ */
/* 首页分享区数据：按主题分享 GitHub 项目 / 头部博主文章 / 好工具。       */
/* 每条：类型（github / article / tool）+ 主题 + 标题 + 一句话 + 链接。  */
/* 运营工作台「分享管理」页可自定义维护。                                */
/* 默认给真实、可点开的开源项目示例；文章与自研工具请在工作台替换。      */
/* ------------------------------------------------------------------ */

export type ShareKind = "github" | "article" | "tool"

export const SHARE_KIND_LABELS: Record<ShareKind, string> = {
  github: "GitHub 项目",
  article: "博主文章",
  tool: "好工具",
}

export interface Share {
  id: string
  kind: ShareKind
  /** 主题（如 AI Agent / 知识管理 / 内容工具） */
  topic: string
  title: string
  note: string
  /** 跳转链接（GitHub 仓库 / 文章主页 / 工具地址） */
  url: string
  /** 博主 / 作者名（article 类建议填写） */
  author?: string
  order: number
  /** 运营工作台可控制：false = 不展示（默认 true） */
  published?: boolean
}

export const SHARES: Share[] = [
  {
    id: "share-langgraph",
    kind: "github",
    topic: "AI Agent 编排",
    title: "LangGraph",
    note: "把多步 Agent 流程建模成图：状态、分支、循环都显式可控，适合把交付流程做成可复用的工作流。",
    url: "https://github.com/langchain-ai/langgraph",
    order: 1,
  },
  {
    id: "share-dify",
    kind: "github",
    topic: "AI 应用平台",
    title: "Dify",
    note: "低代码搭 AI 工作流与知识库应用，规则库、流水线类交付我常用它落地。",
    url: "https://github.com/langgenius/dify",
    order: 2,
  },
  {
    id: "share-openspg",
    kind: "github",
    topic: "知识图谱",
    title: "OpenSPG",
    note: "蚂蚁开源的语义知识图谱引擎，领域本体与知识底座方向值得跟进。",
    url: "https://github.com/OpenSPG/openspg",
    order: 3,
  },
]

/** 按 order 排序后导出 */
export const SHARES_SORTED = [...SHARES].sort((a, b) => a.order - b.order)
