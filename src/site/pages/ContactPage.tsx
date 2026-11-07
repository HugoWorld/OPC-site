import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { sortSolutions, useSiteData } from "@/site/admin/store"
import { CTA, DEFAULT_CONTACT } from "@/site/data/site"
import { Container } from "@/site/components/Layout"

/** 联系与预约落地页：内容来自 contact 切片（缺省回退默认 toB 文案，工作台可覆盖）。 */
export function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const { solutions, contact, cta } = useSiteData()
  const c = contact ?? DEFAULT_CONTACT
  const follow = cta?.follow ?? CTA.follow
  const fl = c.formLabels ?? {}
  const sortedSolutions = sortSolutions(solutions).filter((s) => s.published !== false)

  return (
    <div className="px-6 py-14 md:px-8 md:py-20">
      <Container>
        <div className="max-w-2xl">
          <h1 className="text-gradient text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold tracking-[-0.03em] text-balance">
            {c.heading}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
            {c.lead}
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          {/* 表单 */}
          <div>
            {submitted ? (
              <Card className="glass-card gap-0 py-0">
                <div className="p-10 text-center">
                  <CheckCircle2 className="mx-auto size-10 text-primary" />
                  <h2 className="mt-4 text-[clamp(1.3rem,2.4vw,1.7rem)] font-bold">{c.successTitle}</h2>
                  <p className="mx-auto mt-3 max-w-[40ch] text-[14px] leading-relaxed text-muted-foreground text-pretty">
                    {c.successNote}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => setSubmitted(false)}
                  >
                    {c.resubmitText}
                  </Button>
                </div>
              </Card>
            ) : (
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault()
                  setSubmitted(true)
                }}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      你的称呼 <span className="text-destructive">*</span>
                    </Label>
                    <Input id="name" name="name" required placeholder="张三" autoComplete="name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">
                      {fl.company ?? "公司 / 机构名称"} <span className="text-destructive">*</span>
                    </Label>
                    <Input id="company" name="company" required placeholder="用于判断场景是否匹配" autoComplete="organization" />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">
                      所在城市 <span className="text-destructive">*</span>
                    </Label>
                    <Input id="city" name="city" required placeholder="用于安排演示与上门拜访" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact">
                      微信或手机 <span className="text-destructive">*</span>
                    </Label>
                    <Input id="contact" name="contact" required placeholder="留一个能直接联系到你的" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    {c.moduleLabel} <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {sortedSolutions.map((s) => (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-white/5 px-3.5 py-3 transition-colors hover:bg-white/10 has-[[data-state=checked]]:border-primary/50"
                      >
                        <input type="checkbox" name="modules" value={s.id} className="mt-0.5 accent-[var(--primary)]" />
                        <span>
                          <span className="block text-[13.5px] font-medium">{s.title}</span>
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">{s.subtitle}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="team">{fl.team ?? "团队规模"}</Label>
                    <select
                      id="team"
                      name="team"
                      className="h-9 w-full rounded-md border border-input bg-white/5 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      defaultValue=""
                    >
                      <option value="" disabled>请选择</option>
                      <option value="1-5">1—5 人</option>
                      <option value="6-20">6—20 人</option>
                      <option value="21-100">21—100 人</option>
                      <option value="100+">100 人以上</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="when">{fl.when ?? "期望启动时间"}</Label>
                    <select
                      id="when"
                      name="when"
                      className="h-9 w-full rounded-md border border-input bg-white/5 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      defaultValue=""
                    >
                      <option value="" disabled>请选择</option>
                      <option value="now">本月内</option>
                      <option value="1-3m">1—3 个月内</option>
                      <option value="later">先了解，暂时不启动</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <Input id="email" name="email" type="email" placeholder="用于接收方案书，选填" autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">{fl.source ?? "你是从哪里知道我的"}</Label>
                    <select
                      id="source"
                      name="source"
                      className="h-9 w-full rounded-md border border-input bg-white/5 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      defaultValue=""
                    >
                      <option value="" disabled>请选择</option>
                      <option value="referral">朋友 / 同行介绍</option>
                      <option value="wechat">公众号</option>
                      <option value="search">搜索</option>
                      <option value="xhs">小红书 / 知乎</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="detail">{fl.detail ?? "现在这件事是怎么做的"}</Label>
                  <textarea
                    id="detail"
                    name="detail"
                    rows={4}
                    className="w-full rounded-md border border-input bg-white/5 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    placeholder={fl.detailPlaceholder ?? "谁在做、每天做多久、最常出错的地方"}
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
                    <input type="checkbox" required className="mt-0.5 accent-[var(--primary)]" />
                    <span>
                      我已阅读并同意<Link to="/privacy/" className="text-primary hover:underline">隐私政策</Link>，同意用上述信息与我联系。
                    </span>
                  </label>
                  <label aria-hidden className="flex items-start gap-2.5 text-[12px] text-muted-foreground/60">
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" className="mt-0.5 h-6 w-full max-w-[200px] rounded border border-dashed border-border px-2 text-xs" placeholder="请勿填写" />
                  </label>
                </div>

                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  {c.submitText}
                </Button>
              </form>
            )}
          </div>

          {/* 直接联系 */}
          <div className="space-y-6">
            <Card className="glass-card gap-0 py-0">
              <div className="p-6">
                <h3 className="text-[16px] font-semibold">{c.sidebarTitle}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground text-pretty">
                  {c.sidebarNote}
                </p>
                <Separator className="my-6" />
                <ul className="space-y-5">
                  {c.sidebarMeta.map((m) => (
                    <li key={m.label}>
                      <div className="text-[12px] text-muted-foreground">{m.label}</div>
                      <div className="mt-1 text-[14px] font-medium">{m.value}</div>
                    </li>
                  ))}
                </ul>
                <Separator className="my-6" />
                <p className="text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
                  {c.asideHint}
                </p>
              </div>
            </Card>

            {/* 关注我：公众号二维码（主位引流）+ 平台账号行（次位，不抢预约主行动） */}
            <Card className="glass-card gap-0 py-0">
              <div className="p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[16px] font-semibold">关注我</h3>
                  <span className="text-[11.5px] text-muted-foreground">在别的平台也能找到我</span>
                </div>
                <div className="mt-4 flex items-start gap-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                  {follow.qrUrl ? (
                    <img
                      src={follow.qrUrl}
                      alt="公众号二维码"
                      className="size-24 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="grid size-24 shrink-0 place-items-center rounded-lg border border-dashed border-primary/30 bg-primary/5 text-center text-[11px] leading-relaxed text-primary/70">
                      公众号二维码
                      <br />
                      待上传
                    </div>
                  )}
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground text-pretty">
                    {follow.qrCaption}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {follow.platforms.map((p) =>
                    p.url ? (
                      <a
                        key={p.label}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3.5 py-1.5 text-[12.5px] font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                      >
                        {p.label}
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    ) : (
                      <span
                        key={p.label}
                        className="inline-flex items-center rounded-full border border-dashed border-border px-3.5 py-1.5 text-[12.5px] font-medium text-muted-foreground/70"
                      >
                        {p.label} · 即将上线
                      </span>
                    )
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  )
}
