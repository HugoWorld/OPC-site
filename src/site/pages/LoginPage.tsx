/* ------------------------------------------------------------------ */
/* 运营工作台登录页：跳转飞书网页授权，不再提供模拟登录。                 */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { apiUrl, startBootstrapLogin, startDemoLogin, startFeishuLogin } from "@/site/admin/auth"

function readLoginQuery(): { next: string; error: string } {
  const raw = window.location.hash.replace(/^#/, "")
  const qs = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : ""
  const params = new URLSearchParams(qs)
  const next = params.get("next")
  return {
    next: next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin/",
    error: params.get("error") ?? "",
  }
}

const ERROR_TEXT: Record<string, string> = {
  access_denied: "你在飞书授权页取消了授权，未进入工作台。",
  state_mismatch: "登录校验失败（state 不匹配），请重新发起登录。",
  missing_code: "飞书没有返回授权码，请重新登录。",
  not_allowed: "该飞书账号不在管理员白名单，请联系站点所有者添加。",
  rate_limited: "登录尝试过于频繁，请稍后再试。",
  upstream: "飞书授权服务暂时不可用，请稍后重试。",
  oauth_config: "网关尚未配置飞书应用凭据，请先完成部署配置。",
  demo_mode: "当前是演示模式，只跑通了访客站；配置飞书凭据后即可登录工作台。",
}

/**
 * 真实登录：点击后跳到网关 /api/auth/start，由网关构造飞书授权页地址。
 * 授权成功回跳 /api/auth/callback，网关校验 open_id 白名单后下发 HttpOnly Cookie。
 */
export function LoginPage() {
  const { next, error } = readLoginQuery()
  const [demoMode, setDemoMode] = useState(false)
  const [bootstrapEnabled, setBootstrapEnabled] = useState(false)
  const [oauthConfigured, setOauthConfigured] = useState(true)
  const [bootstrapToken, setBootstrapToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState("")

  useEffect(() => {
    let alive = true
    void fetch(apiUrl("/api/setup"))
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          body:
            | { demoMode?: boolean; bootstrapEnabled?: boolean; oauthConfigured?: boolean }
            | null,
        ) => {
          if (!alive || !body) return
          if (body.demoMode) setDemoMode(true)
          if (body.bootstrapEnabled) setBootstrapEnabled(true)
          if (body.oauthConfigured === false) setOauthConfigured(false)
        },
      )
      .catch(() => {
        /* 网关未启动时保持默认，不影响页面展示 */
      })
    return () => {
      alive = false
    }
  }, [])

  const bootstrapMode = !demoMode && bootstrapEnabled && !oauthConfigured

  const onLogin = () => {
    if (demoMode) {
      setBusy(true)
      setActionError("")
      void startDemoLogin(next)
        .catch((e: unknown) => {
          setActionError(e instanceof Error ? e.message : "演示登录失败，请重试")
        })
        .finally(() => setBusy(false))
      return
    }
    if (bootstrapMode) {
      if (!bootstrapToken.trim()) {
        setActionError("请先填写部署令牌")
        return
      }
      setBusy(true)
      setActionError("")
      void startBootstrapLogin(bootstrapToken.trim(), next)
        .catch((e: unknown) => {
          setActionError(e instanceof Error ? e.message : "部署令牌登录失败，请重试")
        })
        .finally(() => setBusy(false))
      return
    }
    startFeishuLogin(next)
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
            站点内容与外观的统一编辑入口。工作台仅对管理员开放，使用飞书账号登录，
            不再单独维护一套账号密码。
          </p>

          <ul className="mt-7 space-y-2.5 text-[13px] text-muted-foreground">
            {[
              "头像、姓名取自飞书用户信息，不用另传",
              "open_id 由网关校验管理员白名单，不落在前端",
              "会话走 HttpOnly Cookie，退出登录立即撤销",
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
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              {bootstrapMode ? "部署令牌登录" : "飞书授权登录"}
            </span>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
              {ERROR_TEXT[error] ?? `登录未完成（${error}），请重试。`}
            </p>
          ) : null}

          {demoMode ? (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
              当前是演示模式：可以点下面的按钮进入演示工作台，数据只存在本机；
              要改用真实飞书账号，填好
              <code className="mx-1 rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">
                .env
              </code>
              里的飞书 4 项，把
              <code className="mx-1 rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">
                HUGOW_DEMO
              </code>
              改成 0，再重启即可。
            </p>
          ) : null}

          {bootstrapMode ? (
            <div className="mt-4 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-sky-900">
              当前未启用飞书 OAuth。请使用部署时写入
              <code className="mx-1 rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">
                ADMIN_BOOTSTRAP_TOKEN
              </code>
              的令牌进入工作台；令牌只用于管理员登录，不会写入浏览器存储。
              <input
                type="password"
                value={bootstrapToken}
                onChange={(e) => setBootstrapToken(e.target.value)}
                placeholder="部署令牌"
                autoComplete="current-password"
                className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
            </div>
          ) : null}

          {actionError ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-red-700">
              {actionError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onLogin}
            disabled={busy}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#3370ff] text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="grid size-5 place-items-center rounded bg-white/15 text-[11px] font-bold">
              {bootstrapMode ? "令" : "飞"}
            </span>
            {busy
              ? "正在进入…"
              : demoMode
                ? "进入演示工作台"
                : bootstrapMode
                  ? "使用部署令牌进入"
                  : "使用飞书账号登录"}
          </button>

          {demoMode ? (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              演示会话由网关签发，退出登录即失效；不会读取或写入飞书账号。
            </p>
          ) : null}

          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            {demoMode
              ? "演示模式不跳转飞书，只签发一个仅本机有效的演示会话；改回真实登录后，这里才会跳转飞书授权页。"
              : bootstrapMode
                ? "部署令牌由服务端环境变量提供，登录后签发 HttpOnly 会话；飞书 OAuth 恢复后会自动切回飞书授权登录。"
                : "点击后跳转飞书授权页，由飞书返回真实头像、姓名与 open_id；授权完成后回到工作台。首次登录前，需要把 open_id 加入网关的"}
            {!demoMode && !bootstrapMode ? (
              <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80">
                ADMIN_OPEN_IDS
              </code>
            ) : null}
            {!demoMode && !bootstrapMode ? "白名单。" : ""}
          </p>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
            <div className="text-[12px] font-semibold text-foreground">登录后将获取的字段</div>
            <div className="mt-3 space-y-2 text-[12px] text-muted-foreground">
              {[
                ["头像", "avatar_url"],
                ["姓名", "name"],
                ["身份标识", "open_id"],
                ["会话", "HttpOnly Cookie"],
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
            <span className="text-muted-foreground">数据源：飞书多维表格 + 本机快照</span>
          </div>
        </div>
      </div>
    </div>
  )
}
