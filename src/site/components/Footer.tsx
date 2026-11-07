import { Link } from "react-router-dom"

import { useSiteData } from "@/site/admin/store"

/** 站点页脚：四栏导航 + 边界声明 + AIGC 标识。 */
export function Footer() {
  const { site, footerColumns, footerBoundary, footerAigc } = useSiteData()
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                {site.brandShort}
              </span>
              <div>
                <div className="text-[15px] font-semibold">{site.brandName}</div>
                <div className="text-[13px] text-muted-foreground">{site.tagline}</div>
              </div>
            </div>
            <p className="mt-4 max-w-[26ch] text-[13px] leading-relaxed text-muted-foreground">
              把专业服务交付里最重复的几段，做成能直接接手的流水线。
            </p>
          </div>

          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[13px] font-semibold">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      to={l.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-2 border-t border-border pt-6">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{footerBoundary}</p>
          <p className="text-[12px] text-muted-foreground/70">{footerAigc}</p>
          <p className="text-[12px] text-muted-foreground/70">
            © 2026 {site.brandName} · {site.company}
          </p>
        </div>
      </div>
    </footer>
  )
}
