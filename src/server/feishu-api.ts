/* ------------------------------------------------------------------ */
/* 飞书 OpenAPI 的 HTTP 基础设施：超时、JSON 解析、错误码归一化。        */
/*                                                                    */
/* 安全约定：App Secret / access_token 只出现在请求头或请求体，不写日志、 */
/* 不回传前端；错误消息只保留飞书 code/msg 与 HTTP 状态。                */
/* ------------------------------------------------------------------ */

export class FeishuApiError extends Error {
  readonly code: number
  readonly httpStatus: number

  constructor(message: string, code: number, httpStatus = 200) {
    super(message)
    this.name = "FeishuApiError"
    this.code = code
    this.httpStatus = httpStatus
  }
}

export interface FeishuEnvelope<T> {
  code?: number
  msg?: string
  data?: T
  [key: string]: unknown
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface JsonRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  headers?: Record<string, string>
  body?: unknown
  timeoutMs?: number
  fetchImpl?: FetchLike
}

/** 发一个 JSON 请求；网络错误、超时、非 JSON 响应都转成 FeishuApiError。 */
export async function requestJson<T>(
  url: string,
  opts: JsonRequestOptions = {},
): Promise<{ status: number; body: T }> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? 15_000
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.body === undefined ? {} : { "Content-Type": "application/json; charset=utf-8" }),
    ...(opts.headers ?? {}),
  }

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new FeishuApiError(`飞书接口请求失败：${reason}`, -1, 0)
  }

  const text = await response.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    throw new FeishuApiError(
      `飞书接口返回了非 JSON 内容（HTTP ${response.status}）`,
      -2,
      response.status,
    )
  }

  return { status: response.status, body: body as T }
}

/** 飞书业务响应：code=0 视为成功，否则抛错。 */
export function assertFeishuOk<T>(
  body: FeishuEnvelope<T>,
  status: number,
  action: string,
): T {
  const code = typeof body.code === "number" ? body.code : 0
  if (!status || status >= 400 || code !== 0) {
    const msg = typeof body.msg === "string" && body.msg ? body.msg : `飞书错误码 ${code}`
    throw new FeishuApiError(`${action}失败：${msg}（code=${code}）`, code, status)
  }
  return body.data as T
}
