import { HashRouter, Route, Routes, useLocation } from "react-router-dom"
import { lazy, Suspense, useEffect } from "react"

import { SiteStoreProvider, useSiteData } from "@/site/admin/store"
import { PreviewBridge } from "@/site/components/PreviewBridge"
import { Footer } from "@/site/components/Footer"
import { Header } from "@/site/components/Header"
import { DynamicPage, DynamicPageView } from "@/site/pages/DynamicPage"
import { HomePage } from "@/site/pages/HomePage"
import { NotFoundPage } from "@/site/pages/NotFoundPage"

/* 前台二级页按需加载：首屏只下载首页所需代码（PRD O-6 路由级动态导入）。 */
const SolutionsPage = lazy(() =>
  import("@/site/pages/SolutionsPage").then((m) => ({ default: m.SolutionsPage })),
)
const SolutionPage = lazy(() =>
  import("@/site/pages/SolutionPage").then((m) => ({ default: m.SolutionPage })),
)
const MethodPage = lazy(() =>
  import("@/site/pages/MethodPage").then((m) => ({ default: m.MethodPage })),
)
const CasesPage = lazy(() =>
  import("@/site/pages/CasesPage").then((m) => ({ default: m.CasesPage })),
)
const WritingPage = lazy(() =>
  import("@/site/pages/WritingPage").then((m) => ({ default: m.WritingPage })),
)
const ArticlePage = lazy(() =>
  import("@/site/pages/ArticlePage").then((m) => ({ default: m.ArticlePage })),
)
const SharesPage = lazy(() =>
  import("@/site/pages/SharesPage").then((m) => ({ default: m.SharesPage })),
)
const AboutPage = lazy(() =>
  import("@/site/pages/AboutPage").then((m) => ({ default: m.AboutPage })),
)
const ContactPage = lazy(() =>
  import("@/site/pages/ContactPage").then((m) => ({ default: m.ContactPage })),
)
const PrivacyPage = lazy(() =>
  import("@/site/pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
)

/** 二级页按需加载的过渡态：只占位，不闪烁布局。 */
function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      正在加载…
    </div>
  )
}

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
    <div className="site-dark relative min-h-screen overflow-x-clip">
      {/* 背景光斑 + 细网格，玻璃卡片透出它们才有层次 */}
      <div aria-hidden className="ambient pointer-events-none absolute inset-0 -z-10" />
      <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-[0.35]" />
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  )
}

/**
 * 访客站根：只渲染对外站点（`www` 入口）。
 * 登录页与运营工作台在 `AdminApp` 中，由 `admin.html` 单独构建，
 * 这样访客产物里没有工作台代码，也没有 `/api` 与登录态。
 * 站点页面作用域：URL 带 ?preview=1（预览模式）→ draft；否则 published。
 */
export function SiteApp() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
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
      <Suspense fallback={<RouteLoading />}>
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
      </Suspense>
    </SiteStoreProvider>
  )
}
