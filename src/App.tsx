import { SiteApp } from "@/site/SiteApp"

/* ------------------------------------------------------------------ */
/* 「个人IP网站」项目的原型入口。                                     */
/*                                                                     */
/* 这是对外阵地的视觉原型，只渲染站点本身。                            */
/* 工作系统（资产管理 / 业务运营 / 交付）是另一个独立项目，             */
/* 见 ../p2-个人工作系统/prototype。                                   */
/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <SiteApp />
    </div>
  )
}
