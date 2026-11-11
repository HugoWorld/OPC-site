/* ------------------------------------------------------------------ */
/* 运营工作台登录页：飞书扫码登录（主）+ 管理员账号密码（备用）。         */
/* 页面不展示任何环境变量、内部字段、身份标识或数据源细节。               */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import QRCode from "qrcode"

import {
  apiUrl,
  claimQrTicket,
  createQrTicket,
  fetchQrTicketStatus,
  startDemoLogin,
  startFeishuLogin,
  startPasswordLogin,
  type QrTicket,
} from "@/site/admin/auth"

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
  state_mismatch: "登录校验失败，请重新扫码。",
  missing_code: "飞书没有返回授权码，请重新登录。",
  not_allowed: "该飞书账号没有工作台权限，请联系站点所有者。",
  rate_limited: "登录尝试过于频繁，请稍后再试。",
  upstream: "飞书授权服务暂时不可用，请稍后重试。",
  oauth_config: "飞书登录暂不可用，请使用管理员密码登录。",
  demo_mode: "当前是演示模式，只开放演示工作台。",
}

export function LoginPage() {
  const { next, error } = readLoginQuery()
  const [demoMode, setDemoMode] = useState(false)
  const [passwordEnabled, setPasswordEnabled] = useState(false)
  const [oauthEnabled, setOauthEnabled] = useState(true)
  const [mode, setMode] = useState<"qr" | "password">("qr")
  const [qrFailed, setQrFailed] = useState(false)
  const [qrHint, setQrHint] = useState("")
  const [qrTicket, setQrTicket] = useState<QrTicket | null>(null)
  const [qrImage, setQrImage] = useState("")
  const [qrKey, setQrKey] = useState(0)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState("")

  useEffect(() => {
    let alive = true
    void fetch(apiUrl("/api/setup"))
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          body:
            | {
                demoMode?: boolean
                passwordEnabled?: boolean
                oauthConfigured?: boolean
              }
            | null,
        ) => {
          if (!alive || !body) return
          if (body.demoMode) setDemoMode(true)
          if (body.passwordEnabled) setPasswordEnabled(true)
          if (body.oauthConfigured === false) setOauthEnabled(false)
        },
      )
      .catch(() => {
        /* 网关未启动时保留默认，页面不暴露内部状态 */
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!qrTicket) {
      setQrImage("")
      return
    }
    let cancelled = false
    QRCode.toDataURL(qrTicket.url, {
      margin: 1,
      width: 260,
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrImage(dataUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setQrFailed(true)
          setQrHint("二维码生成失败，请刷新")
        }
      })
    return () => {
      cancelled = true
    }
  }, [qrTicket])

  useEffect(() => {
    if (demoMode || !oauthEnabled || mode !== "qr") return
    let cancelled = false
    let pollTimer = 0
    let claiming = false
    setQrFailed(false)
    setQrHint("")
    setQrTicket(null)

    const run = async () => {
      try {
        const ticket = await createQrTicket(next)
        if (cancelled) return
        setQrTicket(ticket)

        const poll = async () => {
          if (cancelled) return
          try {
            const state = await fetchQrTicketStatus(ticket.id)
            if (cancelled) return
            if (state.status === "scanned") {
              setQrHint("已扫描，请在手机上确认")
            } else if (state.status === "authorized") {
              if (claiming) return
              claiming = true
              setQrHint("登录成功，正在进入工作台")
              try {
                const claimed = await claimQrTicket(ticket.id, ticket.token)
                window.location.assign(`#${claimed.next}`)
                return
              } catch (e) {
                claiming = false
                if (e instanceof Error && e.message === "PENDING") {
                  // 手机端状态刚写入，下一轮再领取。
                } else if (e instanceof Error && e.message === "NOT_ALLOWED") {
                  setActionError("该飞书账号没有工作台权限，请使用站点管理员账号。")
                  setQrFailed(true)
                  return
                } else {
                  setActionError(e instanceof Error ? e.message : "登录失败，请刷新二维码")
                  setQrFailed(true)
                  return
                }
              }
            } else if (state.status === "denied") {
              setActionError(
                ERROR_TEXT[state.error ?? "not_allowed"] ?? "该飞书账号没有工作台权限。",
              )
              setQrFailed(true)
              return
            } else if (state.status === "expired") {
              setQrHint("二维码已失效，请刷新")
              setQrFailed(true)
              return
            }
          } catch {
            /* 网络抖动时下一轮继续 */
          }
          pollTimer = window.setTimeout(poll, 2000)
        }
        pollTimer = window.setTimeout(poll, 1500)
      } catch {
        if (!cancelled) {
          setQrFailed(true)
          setQrHint("二维码加载失败，请刷新")
        }
      }
    }
    void run()

    return () => {
      cancelled = true
      if (pollTimer) window.clearTimeout(pollTimer)
    }
  }, [demoMode, oauthEnabled, mode, next, qrKey])

  const onDemoLogin = () => {
    setBusy(true)
    setActionError("")
    void startDemoLogin(next)
      .catch((e: unknown) => {
        setActionError(e instanceof Error ? e.message : "演示登录失败，请重试")
      })
      .finally(() => setBusy(false))
  }

  const onPasswordLogin = () => {
    if (!username.trim() || !password.trim()) {
      setActionError("请填写账号和密码")
      return
    }
    setBusy(true)
    setActionError("")
    void startPasswordLogin(username.trim(), password, next)
      .catch((e: unknown) => {
        setActionError(e instanceof Error ? e.message : "登录失败，请重试")
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="ambient pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid w-full max-w-[1000px] items-center gap-12 px-6 py-14 md:grid-cols-[1.02fr_0.98fr] md:py-20">
        {/* 左：品牌与说明 */}
        <div className="max-w-[440px]">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-[13px] font-bold text-primary-foreground">
              H
            </span>
            <span>
              <span className="block text-[15px] font-semibold leading-tight">HugoW</span>
              <span className="block text-[11.5px] text-muted-foreground">法律与咨询服务交付</span>
            </span>
          </Link>

          <h1 className="mt-9 text-[clamp(1.75rem,3.6vw,2.5rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-balance">
            登录运营工作台
          </h1>
          <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed text-muted-foreground">
            编辑站点内容与外观，发布后即刻同步到前台。
          </p>

          <ul className="mt-7 space-y-3 text-[13px] text-muted-foreground">
            {[
              "内容、页面与主题统一编辑",
              "发布后自动同步线上内容",
              "登录状态由服务端安全会话维护",
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold">管理员登录</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                飞书扫码，或用账号密码
              </div>
            </div>
            {!demoMode ? (
              <div className="flex rounded-lg border border-border bg-muted/50 p-0.5 text-[11.5px]">
                <button
                  type="button"
                  onClick={() => setMode("qr")}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
                    mode === "qr" ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  扫码登录
                </button>
                {passwordEnabled ? (
                  <button
                    type="button"
                    onClick={() => setMode("password")}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
                      mode === "password"
                        ? "bg-background font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    账号密码
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
              {ERROR_TEXT[error] ?? "登录未完成，请重试。"}
            </p>
          ) : null}

          {demoMode ? (
            <div className="mt-5">
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800">
                当前是演示模式，只开放演示工作台，数据仅保存在本机。
              </p>
              <button
                type="button"
                onClick={onDemoLogin}
                disabled={busy}
                className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-primary text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "正在进入…" : "进入演示工作台"}
              </button>
            </div>
          ) : mode === "qr" ? (
            <div className="mt-5">
              {oauthEnabled ? (
                <>
                  <div className="relative mx-auto flex h-[268px] w-[268px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                    {qrImage && !qrFailed ? (
                      <img
                        src={qrImage}
                        alt="飞书登录二维码"
                        width={260}
                        height={260}
                        className="h-[260px] w-[260px]"
                      />
                    ) : null}
                    {!qrImage && !qrFailed ? (
                      <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/85 text-[12px] text-muted-foreground">
                        正在生成二维码…
                      </div>
                    ) : null}
                    {qrFailed ? (
                      <div className="absolute inset-0 grid place-items-center gap-2 rounded-2xl bg-background px-6 text-center">
                        <div className="text-[12.5px] text-muted-foreground">
                          {qrHint || "二维码加载失败"}
                        </div>
                        <button
                          type="button"
                          onClick={() => setQrKey((k) => k + 1)}
                          className="rounded-md border border-border px-3 py-1.5 text-[12px] text-foreground hover:bg-muted"
                        >
                          重新加载
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
                    {qrHint || "打开飞书 App 扫一扫，确认后自动进入工作台"}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQrKey((k) => k + 1)}
                      className="h-10 flex-1 rounded-lg border border-border text-[12.5px] text-foreground transition-colors hover:bg-muted"
                    >
                      刷新二维码
                    </button>
                    <button
                      type="button"
                      onClick={() => startFeishuLogin(next)}
                      className="h-10 flex-1 rounded-lg border border-border text-[12.5px] text-foreground transition-colors hover:bg-muted"
                    >
                      在飞书中打开
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-5 text-center">
                  <div className="text-[13px] font-medium">飞书登录尚未开通</div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                    请使用管理员账号密码登录，或联系站点所有者开通飞书登录。
                  </p>
                  {passwordEnabled ? (
                    <button
                      type="button"
                      onClick={() => setMode("password")}
                      className="mt-4 h-10 w-full rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground"
                    >
                      使用账号密码登录
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5">
              <label className="block text-[12px] font-medium text-muted-foreground" htmlFor="admin-username">
                账号
              </label>
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="请输入管理员账号"
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
              <label
                className="mt-4 block text-[12px] font-medium text-muted-foreground"
                htmlFor="admin-password"
              >
                密码
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="请输入管理员密码"
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
              {actionError ? (
                <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-red-700">
                  {actionError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={onPasswordLogin}
                disabled={busy}
                className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-primary text-[14px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "正在进入…" : "登录工作台"}
              </button>
              <button
                type="button"
                onClick={() => setMode("qr")}
                className="mt-3 h-9 w-full text-[12px] text-muted-foreground hover:text-foreground"
              >
                返回扫码登录
              </button>
            </div>
          )}

          {actionError && mode !== "password" ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] leading-relaxed text-red-700">
              {actionError}
            </p>
          ) : null}

          <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4 text-[12px]">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              返回站点前台
            </Link>
            <span className="text-muted-foreground">仅限管理员访问</span>
          </div>
        </div>
      </div>
    </div>
  )
}
