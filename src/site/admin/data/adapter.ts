/* ------------------------------------------------------------------ */
/* 数据适配器：把「读已发布 / 发布草稿」从具体存储中抽象出来。            */
/* - LocalAdapter：现状实现，读写 localStorage，行为与原型一致；          */
/* - MockAdapter ：内存实现，可注入失败，用于工作台与网关联调前的测试；    */
/* - FeishuAdapter 待网关就位后按本接口实现，UI 与 Store 无需改动。       */
/* ------------------------------------------------------------------ */

import type { EditableData } from "../store"

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
