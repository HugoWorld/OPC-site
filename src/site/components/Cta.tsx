import { Link } from "react-router-dom"
import { ArrowRight, Mail, MapPin, QrCode } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSiteData } from "@/site/admin/store"

/** 全站统一的「联系一下」收尾区：左侧转化文案 + 右侧自定义微信二维码。
 *  primary 未显式传入时跟随 cta 切片；二维码与说明在「站点信息 → 常驻 CTA」自定义（可上传或粘贴链接）。 */
export function CtaBand({
  title = "先聊 30 分钟，判断这件事能不能做",
  lead = "带一份脱敏合同或一段真实的服务流程来，我们直接在上面看能不能跑通。",
  primary,
  secondary = { label: "先看案例", href: "/cases/" },
}: {
  title?: string
  lead?: string
  primary?: { label: string; href: string }
  secondary?: { label: string; href: string }
}) {
  const { cta, hero, theme } = useSiteData()
  const p = primary ?? cta
  const avatar = cta.contactImageUrl || theme.avatarUrl || hero.avatarUrl || ""
  const items = cta.contactItems ?? []
  const mail = items.find((it) => it.label.includes("邮箱"))?.value ?? ""
  const place =
    items.find((it) => it.label.includes("坐标") || it.label.includes("城市"))?.value ?? ""

  return (
    <section data-preview-anchor="cta" className="px-6 py-20 md:px-8">
      <div className="glass-card relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-3xl px-8 py-14 md:px-14">
        <div aria-hidden className="ambient pointer-events-none absolute inset-0 opacity-70" />
        <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 opacity-[0.14]" />

        <div className="relative grid items-center gap-10 md:grid-cols-[1.25fr_0.85fr]">
          {/* 左：转化文案 + 动作 */}
          <div className="text-center md:text-left">
            <h2 className="text-gradient text-[clamp(1.7rem,3.6vw,2.5rem)] font-extrabold tracking-[-0.03em] text-balance">
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground text-pretty md:mx-0">
              {lead}
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3 md:justify-start">
              <Button asChild size="lg" className="gap-2 shadow-glow">
                <Link to={p.href}>
                  {p.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary/30 bg-transparent text-foreground hover:bg-primary/10 hover:text-foreground"
              >
                <Link to={secondary.href}>{secondary.label}</Link>
              </Button>
            </div>
          </div>

          {/* 右：自定义微信二维码（主位） + 邮箱/坐标副信息 */}
          <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              {avatar ? (
                <img
                  src={avatar}
                  alt="联系我"
                  className="size-12 shrink-0 rounded-full border-2 border-primary/30 object-cover shadow-glow md:size-14"
                />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-primary/30 bg-gradient-to-br from-primary to-accent2 text-[20px] font-extrabold text-white shadow-glow md:size-14">
                  {theme.avatarLetter || "H"}
                </span>
              )}
              <div className="min-w-0">
                <div className="text-[14.5px] font-bold">加我微信</div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  工作日当天回，备注来意更快对接
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center rounded-xl border border-border/60 bg-white p-4">
              {cta.wechatQrUrl ? (
                <img
                  src={cta.wechatQrUrl}
                  alt="微信二维码"
                  className="size-[148px] rounded-md object-contain"
                />
              ) : (
                <div className="flex size-[148px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 text-muted-foreground">
                  <QrCode className="size-8" />
                  <span className="text-[11.5px]">二维码待配置</span>
                </div>
              )}
              <p className="mt-3 max-w-[24ch] text-center text-[11.5px] leading-relaxed text-muted-foreground">
                {cta.wechatQrCaption || "微信扫码加我"}
              </p>
            </div>

            {(mail || place) && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-[11.5px] text-muted-foreground">
                {mail ? (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{mail}</span>
                  </span>
                ) : null}
                {place ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    <span>{place}</span>
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** 桌面端常驻悬浮 CTA 钮（跟随 cta 切片，移动端由吸底条承担）。 */
export function FloatCta() {
  const { cta } = useSiteData()
  return (
    <Button
      asChild
      size="lg"
      className="fixed right-6 bottom-6 z-40 hidden shadow-lift md:inline-flex"
      aria-label={cta.label}
    >
      <Link to={cta.href}>{cta.label}</Link>
    </Button>
  )
}

/** 移动端吸底 CTA 条（跟随 cta 切片）。 */
export function MobileCtaBar() {
  const { cta } = useSiteData()
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
      <Button asChild size="lg" className="w-full gap-2">
        <Link to={cta.href}>
          {cta.label}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  )
}
