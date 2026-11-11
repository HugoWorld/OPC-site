/* ------------------------------------------------------------------ */
/* 飞书多维表格（Bitable）记录读写。                                   */
/*                                                                    */
/* 只使用应用身份 tenant_access_token：应用需先被加为 Base 文档应用，    */
/* 并具备 bitable:app 相关权限；否则会返回 91403 / 99991672。           */
/* 记录写入按主键 upsert：先分页读全表，再批量建/改/删，保证 Base 与     */
/* 发布快照同构。                                                      */
/* ------------------------------------------------------------------ */

import {
  FeishuApiError,
  assertFeishuOk,
  requestJson,
  type FeishuEnvelope,
  type FetchLike,
} from "./feishu-api.ts"

export interface BitableRecord {
  record_id: string
  fields: Record<string, unknown>
}

interface RecordPage {
  items?: BitableRecord[]
  has_more?: boolean
  page_token?: string
}

interface TablePage {
  items?: Array<{ table_id?: string; name?: string }>
  has_more?: boolean
  page_token?: string
}

interface TenantTokenResponse {
  code?: number
  msg?: string
  tenant_access_token?: string
  expire?: number
}

export interface FeishuBitableOptions {
  appId: string
  appSecret: string
  appToken: string
  baseUrl?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
  /**
   * 可选：直接注入一个已拿到的 access token（user_access_token 或 tenant_access_token）。
   * 有值时优先使用，不再走 app_id/app_secret 换 tenant token；适用于个人身份
   * OAuth 或企业管理员预置 token 的场景。token 由服务端环境变量注入，永不下发前端。
   */
  accessToken?: string
}

export class FeishuBitable {
  private readonly baseUrl: string
  private readonly appToken: string
  private readonly appId: string
  private readonly appSecret: string
  private readonly fetchImpl: FetchLike
  private readonly timeoutMs: number
  private readonly accessToken: string
  private token: { value: string; expiresAt: number } | null = null

  isConfigured(): boolean {
    return Boolean(this.appToken && (this.accessToken || (this.appId && this.appSecret)))
  }

  /** 列出 Base 内全部数据表；复制模板 Base 后表 ID 会变，必须按表名解析。 */
  async listTables(): Promise<Array<{ tableId: string; name: string }>> {
    const out: Array<{ tableId: string; name: string }> = []
    let pageToken = ""
    do {
      const query = new URLSearchParams({ page_size: "100" })
      if (pageToken) query.set("page_token", pageToken)
      const path =
        `/open-apis/bitable/v1/apps/${encodeURIComponent(this.appToken)}` +
        `/tables?${query.toString()}`
      const page = await this.call<TablePage>("GET", path)
      for (const item of page?.items ?? []) {
        if (item.table_id && item.name) {
          out.push({ tableId: item.table_id, name: item.name })
        }
      }
      pageToken = page?.has_more && page.page_token ? page.page_token : ""
    } while (pageToken)
    return out
  }

  constructor(opts: FeishuBitableOptions) {
    this.baseUrl = (opts.baseUrl ?? "https://open.feishu.cn").replace(/\/$/, "")
    this.appToken = opts.appToken
    this.appId = opts.appId
    this.appSecret = opts.appSecret
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.timeoutMs = opts.timeoutMs ?? 20_000
    this.accessToken = opts.accessToken?.trim() ?? ""
  }

  private async tenantToken(force = false): Promise<string> {
    if (this.accessToken) return this.accessToken
    const now = Date.now()
    if (!force && this.token && this.token.expiresAt > now + 60_000) {
      return this.token.value
    }
    const res = await requestJson<TenantTokenResponse>(
      `${this.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`,
      {
        method: "POST",
        body: { app_id: this.appId, app_secret: this.appSecret },
        fetchImpl: this.fetchImpl,
        timeoutMs: this.timeoutMs,
      },
    )
    const body = res.body
    const code = typeof body.code === "number" ? body.code : 0
    if (!res.status || res.status >= 400 || code !== 0 || !body.tenant_access_token) {
      throw new FeishuApiError(
        `获取 tenant_access_token 失败：${body.msg ?? "未知错误"}（code=${code}）`,
        code,
        res.status,
      )
    }
    const expire = typeof body.expire === "number" ? body.expire : 7200
    this.token = {
      value: body.tenant_access_token,
      expiresAt: now + Math.max(60, expire) * 1000,
    }
    return this.token.value
  }

  private async call<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    retryToken = true,
  ): Promise<T> {
    const token = await this.tenantToken()
    const res = await requestJson<FeishuEnvelope<T>>(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body,
      fetchImpl: this.fetchImpl,
      timeoutMs: this.timeoutMs,
    })
    const code = typeof res.body.code === "number" ? res.body.code : 0
    // 99991663：tenant_access_token 无效/过期；强制刷新后重试一次。
    if (retryToken && (code === 99991663 || code === 99991661)) {
      await this.tenantToken(true)
      return this.call<T>(method, path, body, false)
    }
    return assertFeishuOk(res.body, res.status, path)
  }

  async listRecords(tableId: string): Promise<BitableRecord[]> {
    const records: BitableRecord[] = []
    let pageToken = ""
    do {
      const query = new URLSearchParams({ page_size: "200" })
      if (pageToken) query.set("page_token", pageToken)
      const path =
        `/open-apis/bitable/v1/apps/${encodeURIComponent(this.appToken)}` +
        `/tables/${encodeURIComponent(tableId)}/records?${query.toString()}`
      const page = await this.call<RecordPage>("GET", path)
      if (Array.isArray(page?.items)) records.push(...page.items)
      pageToken = page?.has_more && page.page_token ? page.page_token : ""
    } while (pageToken)
    return records
  }

  async createRecord(
    tableId: string,
    fields: Record<string, unknown>,
  ): Promise<BitableRecord> {
    const path =
      `/open-apis/bitable/v1/apps/${encodeURIComponent(this.appToken)}` +
      `/tables/${encodeURIComponent(tableId)}/records`
    const data = await this.call<{ record?: BitableRecord }>("POST", path, { fields })
    if (!data?.record?.record_id) throw new FeishuApiError("创建记录未返回 record_id", -3, 200)
    return data.record
  }

  async updateRecord(
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<BitableRecord> {
    const path =
      `/open-apis/bitable/v1/apps/${encodeURIComponent(this.appToken)}` +
      `/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`
    const data = await this.call<{ record?: BitableRecord }>("PUT", path, { fields })
    return data?.record ?? { record_id: recordId, fields }
  }

  async deleteRecord(tableId: string, recordId: string): Promise<void> {
    const path =
      `/open-apis/bitable/v1/apps/${encodeURIComponent(this.appToken)}` +
      `/tables/${encodeURIComponent(tableId)}/records/${encodeURIComponent(recordId)}`
    await this.call<unknown>("DELETE", path)
  }
}
