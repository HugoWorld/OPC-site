/* ------------------------------------------------------------------ */
/* 发布快照读取：current.json 指针 → 版本快照。                          */
/* 前台启动时调用；任何网络/解析失败都返回 null，由调用方回落内置默认值。 */
/* ------------------------------------------------------------------ */

import type { EditableData } from "../store"

export interface SnapshotEnvelope {
  version: string
  generatedAt: number
  operatorSuffix?: string
  data: Partial<EditableData>
}

export interface SnapshotReaderOptions {
  /** 站点根路径，默认 "./" */
  base?: string
  /** 注入 fetch，便于测试与替换实现 */
  fetchImpl?: typeof fetch
  /** 单步超时毫秒，默认 3000 */
  timeoutMs?: number
}

function joinUrl(base: string, path: string): string {
  return base.endsWith("/") ? base + path : base + "/" + path
}

export async function readSnapshot(
  opts: SnapshotReaderOptions = {},
): Promise<SnapshotEnvelope | null> {
  const base = opts.base ?? "./"
  const fetchImpl = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? 3000

  const getJson = async (url: string): Promise<unknown> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      // 不在前端强制 no-store：缓存策略交给 CDN/对象存储的响应头。
      // current.json 用 max-age=30 + stale-while-revalidate，版本文件 immutable；
      // 若在这里 no-store，每次首屏都会回源，突发流量直接打到源站。
      const res = await fetchImpl(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    const current = (await getJson(joinUrl(base, "data/current.json"))) as {
      releaseId?: string
      version?: string
    }
    const releaseId = current.releaseId ?? current.version
    if (!releaseId) return null

    const envelope = (await getJson(
      joinUrl(base, `data/snapshot-${releaseId}.json`),
    )) as SnapshotEnvelope

    if (!envelope || typeof envelope !== "object" || !envelope.data) return null
    return envelope
  } catch {
    return null
  }
}
