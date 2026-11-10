/* ------------------------------------------------------------------ */
/* 数据适配器：把「读已发布 / 发布草稿」从具体存储中抽象出来。            */
/* - FeishuAdapter：生产实现，读网关快照、发布走 /api/publish；           */
/* - LocalAdapter：本地回退，读写 localStorage；                         */
/* - MockAdapter ：内存实现，可注入失败，用于工作台与网关联调前的测试。    */
/* ------------------------------------------------------------------ */

import type { SnapshotEnvelope } from "./snapshot"
import type { EditableData } from "../store"

/* 网关地址：与 auth.tsx 保持同一口径；在 Node 单测里 import.meta.env 不存在，
 * 因此用可选链兜底，避免把整条脚本链拖进浏览器模块。 */
const GATEWAY_BASE = import.meta.env?.VITE_GATEWAY_BASE ?? ""
function apiUrl(path: string): string {
  return `${GATEWAY_BASE}${path}`
}

export interface TableFailure {
  table: string
  code: string
  message: string
  retryable: boolean
}

export interface LoadResult {
  overrides: Partial<EditableData>
  source: "local" | "snapshot" | "remote"
  version?: string
  fetchedAt?: number
}

export type PublishResult =
  | { status: "ok"; version: string; writtenTables: string[]; at: number }
  | {
      status: "partial"
      version?: string
      writtenTables: string[]
      failedTables: TableFailure[]
    }
  | { status: "failed"; failedTables: TableFailure[] }

export interface DataAdapter {
  readonly id: "local" | "mock" | "feishu"
  load(): Promise<LoadResult>
  publish(draft: Partial<EditableData>, opts?: { message?: string }): Promise<PublishResult>
}

/* ---------------- 存储抽象 ---------------- */

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LocalAdapterOptions {
  draftKey: string
  publishedKey: string
  storage: StorageLike
}

function parseOverrides(raw: string | null): Partial<EditableData> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object"
      ? (parsed as Partial<EditableData>)
      : {}
  } catch {
    return {}
  }
}

/* ---------------- 飞书 / 网关适配器 ---------------- */

/**
 * 生产数据适配器：
 * - load：GET /api/snapshot/current，与访客站读取的 data/current.json 同源；
 * - publish：POST /api/publish，由网关串行写 12 张表、切快照指针；
 * - 401 抛「会话过期」，429 抛「发布过于频繁」，207 原样返回 partial。
 */
export class FeishuAdapter implements DataAdapter {
  readonly id = "feishu"

  async load(): Promise<LoadResult> {
    const res = await fetch(apiUrl("/api/snapshot/current"), {
      credentials: "include",
      headers: { accept: "application/json" },
    })
    if (!res.ok) throw new Error(`快照不可用（HTTP ${res.status}）`)
    const envelope = (await res.json()) as SnapshotEnvelope
    if (!envelope || typeof envelope.data !== "object" || envelope.data === null) {
      throw new Error("快照格式不合法")
    }
    return {
      overrides: envelope.data,
      source: "snapshot",
      version: envelope.version,
      fetchedAt: Date.now(),
    }
  }

  async publish(draft: Partial<EditableData>): Promise<PublishResult> {
    const res = await fetch(apiUrl("/api/publish"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ draft }),
    })
    if (res.status === 401) throw new Error("登录已过期，请重新登录")
    if (res.status === 429) throw new Error("发布过于频繁，请稍后再试")
    const payload = (await res.json().catch(() => null)) as
      | PublishResult
      | { error?: { code?: string; message?: string } }
      | null
    if (!payload) throw new Error(`发布响应无法解析（HTTP ${res.status}）`)
    if (res.ok || res.status === 207) return payload as PublishResult
    throw new Error(
      ("error" in payload && payload.error?.message) || `发布失败（HTTP ${res.status}）`,
    )
  }
}

/**
 * 按环境选择适配器：默认 feishu；VITE_DATA_ADAPTER=local 时退回 localStorage，
 * 便于纯静态预览与离线演示。UI 与 Store 只依赖 DataAdapter 接口。
 */
export function createDataAdapter(): DataAdapter {
  const kind = import.meta.env?.VITE_DATA_ADAPTER
  if (kind === "local" && typeof localStorage !== "undefined") {
    return new LocalAdapter({
      draftKey: "hugow-admin-draft-v1",
      publishedKey: "hugow-admin-published-v1",
      storage: localStorage,
    })
  }
  return new FeishuAdapter()
}

/* ---------------- 本地适配器 ---------------- */

export class LocalAdapter implements DataAdapter {
  readonly id = "local"
  private readonly opts: LocalAdapterOptions

  constructor(opts: LocalAdapterOptions) {
    this.opts = opts
  }

  async load(): Promise<LoadResult> {
    return {
      overrides: parseOverrides(this.opts.storage.getItem(this.opts.publishedKey)),
      source: "local",
      fetchedAt: Date.now(),
    }
  }

  async publish(draft: Partial<EditableData>): Promise<PublishResult> {
    const at = Date.now()
    this.opts.storage.setItem(this.opts.publishedKey, JSON.stringify(draft))
    return {
      status: "ok",
      version: `local-${at}`,
      writtenTables: [],
      at,
    }
  }
}

/* ---------------- Mock 适配器 ---------------- */

export interface MockAdapterOptions {
  /** 非空时 publish 返回 failed，模拟这些表写入失败（partial 行为由真实网关实现）。 */
  failTables?: string[]
  latencyMs?: number
}

export class MockAdapter implements DataAdapter {
  readonly id = "mock"
  private memory: Partial<EditableData> = {}
  private version?: string
  private readonly failTables: string[]
  private readonly latencyMs: number

  constructor(opts: MockAdapterOptions = {}) {
    this.failTables = opts.failTables ?? []
    this.latencyMs = opts.latencyMs ?? 0
  }
  private delay(): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs))
  }

  async load(): Promise<LoadResult> {
    await this.delay()
    return {
      overrides: structuredClone(this.memory),
      source: "remote",
      version: this.version,
      fetchedAt: Date.now(),
    }
  }

  async publish(draft: Partial<EditableData>): Promise<PublishResult> {
    await this.delay()
    const at = Date.now()

    if (this.failTables.length > 0) {
      const failedTables: TableFailure[] = this.failTables.map((table) => ({
        table,
        code: "PWB_TABLE_FAILED",
        message: `模拟表 ${table} 写入失败`,
        retryable: true,
      }))
      return { status: "failed", failedTables }
    }

    this.memory = structuredClone(draft)
    this.version = `mock-${at}`
    return {
      status: "ok",
      version: this.version,
      writtenTables: ["solutions"],
      at,
    }
  }
}
