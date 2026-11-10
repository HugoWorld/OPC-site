/* ------------------------------------------------------------------ */
/* 本机网关进程入口：127.0.0.1:8787。                                   */
/*                                                                    */
/* 只负责 Node 请求/响应与网关请求对象的搬运；鉴权、限流、发布、快照等   */
/* 全部在 gateway.ts 与注入的实现里。systemd 的 ExecStart 指向本文件。   */
/* ------------------------------------------------------------------ */

import http from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"

import {
  createGateway,
  type GatewayRequest,
  type GatewayResponse,
} from "./gateway.ts"
import { loadConfig } from "./config.ts"
import { createFeishuClient, buildFeishuAuthorizeUrl } from "./feishu-client.ts"
import { FeishuBitable } from "./feishu-bitable.ts"
import { createFeishuPublisher, parseTableIds } from "./feishu-publisher.ts"
import { createLocalSnapshotService } from "./local-snapshot.ts"
import { createSignedSessionStore } from "./session.ts"

const MAX_BODY_BYTES = 2 * 1024 * 1024

function headersOf(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value
  }
  return out
}

async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    total += buf.length
    if (total > MAX_BODY_BYTES) return null
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString("utf8")
}

function sendNodeResponse(res: ServerResponse, result: GatewayResponse): void {
  res.writeHead(result.status, result.headers)
  res.end(result.body)
}

async function main(): Promise<void> {
  const config = loadConfig()
  const snapshots = createLocalSnapshotService({ dataDir: config.dataDir })
  const bitable = new FeishuBitable({
    appId: config.appId,
    appSecret: config.appSecret,
    appToken: config.bitableAppToken,
    baseUrl: config.feishuBaseUrl,
  })
  const publisher = createFeishuPublisher({
    bitable,
    snapshots,
    tableIds: parseTableIds(process.env.FEISHU_TABLE_IDS_JSON),
  })
  const sessions = createSignedSessionStore({ secret: config.sessionSecret })
  const feishu = createFeishuClient({
    appId: config.appId,
    appSecret: config.appSecret,
    redirectUri: config.redirectUri,
    baseUrl: config.feishuBaseUrl,
  })

  const gateway = createGateway({
    feishu,
    sessions,
    publisher,
    snapshots,
    adminOpenIds: config.adminOpenIds,
    sessionTtlMs: config.sessionTtlMs,
    secureCookies: config.secureCookies,
    demoMode: config.demoMode,
    publicAdminOrigin: config.publicAdminOrigin,
    adminEntryPath: config.adminEntryPath,
    oauth: config.demoMode
      ? undefined
      : {
          redirectUri: config.redirectUri,
          authorizeUrl: (state, redirectUri) =>
            buildFeishuAuthorizeUrl({
              appId: config.appId,
              redirectUri,
              state,
              scope: config.oauthScope,
              accountsBase: config.feishuAccountsBaseUrl,
            }),
        },
  })

  const server = http.createServer((req, res) => {
    void (async () => {
      const bodyText = await readBody(req)
      if (bodyText === null) {
        sendNodeResponse(res, {
          status: 413,
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: { code: "BODY_TOO_LARGE", message: "请求体过大" } }),
        })
        req.destroy()
        return
      }
      const request: GatewayRequest = {
        method: req.method ?? "GET",
        url: req.url ?? "/",
        headers: headersOf(req),
        bodyText,
      }
      const result = await gateway(request)
      sendNodeResponse(res, result)
    })().catch((err) => {
      console.error("[gateway] unhandled request error", err)
      if (!res.headersSent) {
        sendNodeResponse(res, {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({ error: { code: "INTERNAL", message: "服务内部错误" } }),
        })
      } else {
        res.end()
      }
    })
  })

  server.requestTimeout = 15_000
  server.headersTimeout = 20_000
  server.keepAliveTimeout = 5_000

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(config.port, config.host, () => {
      server.off("error", reject)
      resolve()
    })
  })

  console.log(
    `[gateway] listening on http://${config.host}:${config.port} ` +
      `(oauth redirect: ${config.redirectUri})`,
  )

  let closing = false
  const shutdown = (signal: string) => {
    if (closing) return
    closing = true
    console.log(`[gateway] ${signal} received, shutting down`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

main().catch((err) => {
  console.error("[gateway] 启动失败：", err instanceof Error ? err.message : err)
  process.exit(1)
})
