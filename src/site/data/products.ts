/* ------------------------------------------------------------------ */
/* 产品展示区数据：首页「我的产品」轮播卡。                              */
/* 字段：产品图片（coverUrl，空 = 渐变占位）、介绍、个性标签、分类标签、 */
/*       产品链接（点击跳转到对应产品页）。                              */
/* 运营工作台「产品管理」页可自定义维护。                                */
/* ------------------------------------------------------------------ */

export interface Product {
  id: string
  name: string
  intro: string
  /** 个性标签（中等力度，2—4 个短词） */
  tags: string[]
  /** 分类标签（如 效率工具 / 知识库 / 合规自动化） */
  category: string
  /** 产品链接：点击跳转（可为站内路由或外部链接） */
  link: string
  /** 产品图片 URL（空 = 组件用主题渐变 + 图标占位） */
  coverUrl?: string
  /** 关联的演示视频 id（见 demoVideos；空 = 无） */
  demoVideoId?: string
  order: number
  /** 运营工作台可控制：false = 不展示（默认 true） */
  published?: boolean
}

export const PRODUCTS: Product[] = [
  {
    id: "legal-contract-flow",
    name: "合同审查流水线",
    intro: "把一份合同要审的点，做成可勾选的审查清单与台账，审到什么、改了什么都有留痕。",
    tags: ["审查清单", "台账留痕"],
    category: "审查工具",
    link: "/solutions/legal-contract-flow/",
    order: 1,
  },
  {
    id: "legal-case-sop",
    name: "案件流程管理",
    intro: "把接案到结案的动作拆成有节点、有留痕的流程 SOP，材料和进度都落在同一处。",
    tags: ["流程 SOP", "节点留痕"],
    category: "流程工具",
    link: "/solutions/legal-case-sop/",
    order: 2,
  },
  {
    id: "legal-compliance-watch",
    name: "法规更新与合规自检",
    intro: "定时盯法规变更，把合规自检做成可勾选的清单，失效引用提前标出来。",
    tags: ["合规自动化", "定期巡检"],
    category: "合规工具",
    link: "/solutions/legal-compliance-watch/",
    order: 3,
  },
]

/** 按 order 排序后导出 */
export const PRODUCTS_SORTED = [...PRODUCTS].sort((a, b) => a.order - b.order)

export function getProduct(id: string) {
  return PRODUCTS.find((p) => p.id === id)
}
