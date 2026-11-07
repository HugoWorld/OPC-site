import { HashRouter, Route, Routes, useLocation } from "react-router-dom"
import { useEffect } from "react"

import { SiteStoreProvider, useSiteData } from "@/site/admin/store"
import { AdminPage } from "@/site/admin/AdminPage"
import { PreviewBridge } from "@/site/components/PreviewBridge"
import { FloatCta, MobileCtaBar } from "@/site/components/Cta"
import { Footer } from "@/site/components/Footer"
import { Header } from "@/site/components/Header"
import { AboutPage } from "@/site/pages/AboutPage"
import { ArticlePage } from "@/site/pages/ArticlePage"
import { CasesPage } from "@/site/pages/CasesPage"
import { ContactPage } from "@/site/pages/ContactPage"
import { DynamicPage, DynamicPageView } from "@/site/pages/DynamicPage"
import { HomePage } from "@/site/pages/HomePage"
import { LoginPage } from "@/site/pages/LoginPage"
import { MethodPage } from "@/site/pages/MethodPage"
import { NotFoundPage } from "@/site/pages/NotFoundPage"
import { PrivacyPage } from "@/site/pages/PrivacyPage"
import { SolutionPage } from "@/site/pages/SolutionPage"
import { SolutionsPage } from "@/site/pages/SolutionsPage"
import { SharesPage } from "@/site/pages/SharesPage"
import { WritingPage } from "@/site/pages/WritingPage"

/** 路由切换时回到顶部（原型体验细节）。 */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [pathname])
  return null
}

/** 对外站点统一布局：深色玻璃作用域 + 背景光斑 + 页头/内容/页脚/CTA。 */
function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-dark relative min-h-screen overflow-x-clip pb-16 md:pb-0">
      {/* 背景光斑 + 细网格，玻璃卡片透出它们才有层次 */}
      <div aria-hidden className="ambient pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-[0.35]" />
      <Header />
      <main>{children}</main>
      <Footer />
      <FloatCta />
      <MobileCtaBar />
    </div>
  )
}

/**
 * 站点原型根：路由 + 布局。
 * 使用 HashRouter（原型阶段便于静态预览与刷新不回 404）。
 * - /admin 与 /admin/* 为运营工作台（独立布局，数据作用域=draft）。
 * - 站点页面作用域：URL 带 ?preview=1（预览模式）→ draft；否则 published。
 * - 预览模式下挂载 PreviewBridge，接收工作台的定位/高亮指令。
 */
export function SiteApp() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        {/* 登录页（FR-AUTH）：独立布局，不放站点页头页脚 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/" element={<LoginPage />} />

        {/* 运营工作台（独立布局，草稿作用域） */}
        <Route
          path="/admin"
          element={
            <SiteStoreProvider scope="draft">
              <AdminPage />
            </SiteStoreProvider>
          }
        />
        <Route
          path="/admin/*"
          element={
            <SiteStoreProvider scope="draft">
              <AdminPage />
            </SiteStoreProvider>
          }
        />

        {/* 对外站点（统一布局，作用域随 preview 参数） */}
        <Route path="*" element={<SiteRoutes />} />
      </Routes>
    </HashRouter>
  )
}

/**
 * 首页路由（首页换肤映射）：
 * - theme.homePageSlug 指向页面注册表里的自定义页（如 studio）且页面存在
 *   → / 路由渲染该页面区块（模板首页 / 导入页）；
 * - 未设置或页面不存在 → 渲染内置首页 HomePage。
 * 预览模式（?preview=1）同样生效，工作台即可看到映射后的首页效果。
 */
function HomeRoute() {
  const { theme, pages } = useSiteData()
  const slug = theme.homePageSlug
  const page = slug ? pages.find((p) => p.slug === slug) : undefined
  if (slug && page) {
    return (
      <DynamicPageView page={page} pathNote={`首页模板 · 已映射到 /（注册表 ${slug}）`} />
    )
  }
  return <HomePage />
}

function SiteRoutes() {
  const { search } = useLocation()
  const preview = search.includes("preview=1")
  return (
    <SiteStoreProvider scope={preview ? "draft" : "published"}>
      <PreviewBridge />
      <Routes>
        <Route path="/" element={<SiteLayout><HomeRoute /></SiteLayout>} />
        <Route path="/solutions/" element={<SiteLayout><SolutionsPage /></SiteLayout>} />
        <Route path="/solutions/:id/" element={<SiteLayout><SolutionPage /></SiteLayout>} />
        <Route path="/method/" element={<SiteLayout><MethodPage /></SiteLayout>} />
        <Route path="/cases/" element={<SiteLayout><CasesPage /></SiteLayout>} />
        <Route path="/writing/" element={<SiteLayout><WritingPage /></SiteLayout>} />
        <Route path="/writing/:category/" element={<SiteLayout><WritingPage /></SiteLayout>} />
        <Route path="/writing/:category/:slug/" element={<SiteLayout><ArticlePage /></SiteLayout>} />
        <Route path="/shares/" element={<SiteLayout><SharesPage /></SiteLayout>} />
        <Route path="/about/" element={<SiteLayout><AboutPage /></SiteLayout>} />
        <Route path="/contact/" element={<SiteLayout><ContactPage /></SiteLayout>} />
        <Route path="/privacy/" element={<SiteLayout><PrivacyPage /></SiteLayout>} />
        <Route path="/pages/:slug/" element={<SiteLayout><DynamicPage /></SiteLayout>} />
        <Route path="*" element={<SiteLayout><NotFoundPage /></SiteLayout>} />
      </Routes>
    </SiteStoreProvider>
  )
}
