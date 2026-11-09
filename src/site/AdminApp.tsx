import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { lazy, Suspense, useEffect } from "react"

import { SiteStoreProvider } from "@/site/admin/store"
import { LoginPage } from "@/site/pages/LoginPage"

/* ------------------------------------------------------------------ */
/* 管理台根：只渲染登录页与运营工作台（admin 入口）。                    */
/* 与 SiteApp 分开构建，访客产物因此不含编辑器代码与登录态。             */
/* 网关挂在同子域的 /api 下，会话 Cookie 只属于这个入口。                */
/* ------------------------------------------------------------------ */

/** 工作台按需加载：登录页不必先下载编辑器。 */
const AdminPageLazy = lazy(() =>
  import("@/site/admin/AdminPage").then((m) => ({ default: m.AdminPage })),
)

function AdminRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          正在加载运营工作台…
        </div>
      }
    >
      <SiteStoreProvider scope="draft">
        <AdminPageLazy />
      </SiteStoreProvider>
    </Suspense>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [pathname])
  return null
}

export function AdminApp() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        {/* 登录页（FR-AUTH）：独立布局，不放站点页头页脚 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/" element={<LoginPage />} />

        {/* 运营工作台（独立布局，草稿作用域，按需加载） */}
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="/admin/*" element={<AdminRoute />} />

        {/* 管理台根路径一律落到工作台，由工作台自己判断登录态 */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </HashRouter>
  )
}
