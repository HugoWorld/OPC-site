import { SiteApp } from "@/site/SiteApp"

/* 个人专业门户原型入口：前台站点、运营工作台、登录页共用同一个 SPA。 */
export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <SiteApp />
    </div>
  )
}
