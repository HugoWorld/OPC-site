import { Link, NavLink, useLocation } from "react-router-dom"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSiteData } from "@/site/admin/store"

/**
 * 站点页头：品牌 + 导航 + 常驻 CTA。
 * 移动端：品牌 + CTA，导航收纳在「能做什么」等路由内（原型阶段用简化方案）。
 */
export function Header() {
  const { site, nav, cta, pages } = useSiteData()
  const { pathname } = useLocation()
  // 已经在联系页时不重复摆「预约一次演示」（按钮会指向当前页，点了没有反应）
  const hideCta = pathname.startsWith("/contact")
  // 主导航 = 内置 NAV + 注册表内 inNav 的动态页面（通用化能力）
  const dynamicNav = pages.filter((p) => p.inNav).map((p) => ({ label: p.title, href: `/pages/${p.slug}/` }))
  const items = [...nav, ...dynamicNav]
  return (
    <header className="glass-strong sticky top-0 z-50 border-b border-border/60">
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-4 px-6">
        <Link to="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-glow transition-transform duration-300 group-hover:scale-105">
            {site.brandShort}
          </span>
          <span className="min-w-0 text-[15px] font-semibold tracking-[-0.01em]">
            {site.brandName}
            <span className="ml-2 hidden text-[13px] font-normal text-muted-foreground sm:inline">
              {site.tagline}
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-[14px] text-muted-foreground md:flex" aria-label="主导航">
          {items.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                `rounded-full px-3 py-1.5 transition-all duration-300 ${
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-white/5 hover:text-foreground"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {hideCta ? null : (
          <Button asChild size="sm" className="gap-1.5 shrink-0 shadow-glow">
            <Link to={cta.href}>
              {cta.label}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
