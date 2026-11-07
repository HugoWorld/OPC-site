import { Link } from "react-router-dom"

import { MOCK_USER, shortOpenId, signInMock } from "@/site/admin/auth"

/**
 * 运营工作台登录页（FR-AUTH）。
 *
 * 原型阶段：模拟飞书登录 —— 点击后写入占位会话（头像 / 姓名 / open_id 均为占位值），
 * 然后回到 next 指定的工作台地址。真实接入时本页只保留「跳转飞书授权」这一步，
 * 其余展示字段与真实 user_info 一一对应，无需改版。
 */
export function LoginPage() {
  const onLogin = () => {
    signInMock()
    // HashRouter 下查询串在 hash 内：#/login/?next=/admin/
    const raw = window.location.hash.replace(/^#/, "")
    const qs = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : ""
    const next = new URLSearchParams(qs).get("next") || "/admin/"
    window.location.hash = "#" + (next.startsWith("/") ? next : "/admin/")
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="ambient pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid w-full max-w-[980px] items-center gap-10 px-6 py-14 md:grid-cols-[1.05fr_0.95fr] md:py-20">
        {/* 左：说明 */}
        <div className="max-w-[460px]">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-[13px] font-bold text-primary-foreground">
              H
            </span>
            <span>
              <span className="block text-[15px] font-semibold leading-tight">HugoW</span>
              <span className="block text-[11.5px] text-muted-foreground">法律与咨询服务交付</span>
            </span>
          </Link>

          <h1 className="mt-9 text-[clamp(1.7rem,3.4vw,2.3rem)] font-extrabold leading-[1.15] tracking-[-0.02em] text-balance">
            登录运营工作台
          </h1>
          <p className="mt-3 max-w-[42ch] text-[14px] leading-relaxed text-muted-foreground">
            站点内容与外观的统一编辑入口。工作台仅对管理员开放，使用飞书账号登录，不再单独维护一套账号密码。
          </p>

          <ul className="mt-7 space-y-2.5 text-[13px] text-muted-foreground">
            {[
              "头像、姓名取自飞书用户信息，不用另传",
              "open_id 用于管理员白名单校验与操作留痕",
              "登录与草稿数据分开存放，退出登录不影响已写内容",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 右：登录卡 */}
        <div className="glass-card rounded-2xl p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">管理员登录</span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              原型 · 模拟登录
            </span>
          </div>

          <button
            type="button"
            onClick={onLogin}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#3370ff] text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <span className="grid size-5 place-items-center rounded bg-white/15 text-[11px] font-bold">飞</span>
            使用飞书账号登录
          </button>

          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            点击后以占位账号进入工作台：姓名「{MOCK_USER.name}」、open_id「{shortOpenId(MOCK_USER.openId)}」。
            正式环境会跳转飞书授权页，由飞书返回真实头像与身份。
          </p>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-[12px] font-semibold text-foreground">登录后将获取的字段</div>
            <div className="mt-3 space-y-2 text-[12px] text-muted-foreground">
              {[
                ["头像", "avatar_url"],
                ["姓名", "name"],
                ["身份标识", "open_id"],
                ["所属部门（可选）", "department_ids"],
              ].map(([label, field]) => (
                <div key={field} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground/80">
                    {field}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              返回站点前台
            </Link>
            <span className="text-muted-foreground">数据源：本地浏览器（待接飞书多维表格）</span>
          </div>
        </div>
      </div>
    </div>
  )
}
