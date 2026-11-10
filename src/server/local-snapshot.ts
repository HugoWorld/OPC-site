/* ------------------------------------------------------------------ */
/* 本机磁盘快照存储：current.json 指针 + 不可变版本文件。                 */
/*                                                                    */
/* 目录结构（与前台 readSnapshot 的读取协议严格一致）：                   */
/*   data/current.json                 { releaseId, version }           */
/*   data/snapshot-<releaseId>.json    SnapshotEnvelope                 */
/*                                                                    */
/* 写入顺序：先写版本文件（独占创建，不覆盖历史），再原子切换 current。   */
/* 单实例由 keyed mutex 串行化；多实例时 CAS 仍然生效。                  */
/* ------------------------------------------------------------------ */

import { promises as fs } from "node:fs"
import type { FileHandle } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { publishSnapshotWithCas, type VersionPointerStore } from "./publish-guard.ts"
import type { SnapshotEnvelope } from "../site/admin/data/snapshot.ts"

export interface LocalSnapshotService {
  current(): Promise<SnapshotEnvelope>
  /** 写入版本文件并切换指针；返回最终版本号。 */
  publish(envelope: SnapshotEnvelope): Promise<string>
}

export interface LocalSnapshotOptions {
  dataDir: string
  /** 注入时间，测试可固定 */
  now?: () => number
}

async function readJson(file: string): Promise<unknown | null> {
  try {
    const text = await fs.readFile(file, "utf8")
    return JSON.parse(text) as unknown
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") return null
    throw err
  }
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const dir = path.dirname(file)
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`)
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8")
  try {
    await fs.rename(tmp, file)
  } catch (err) {
    // Windows 上目标存在时 rename 可能失败；退化为先删后改名。
    const code = (err as NodeJS.ErrnoException).code
    if (code !== "EEXIST" && code !== "EPERM") throw err
    await fs.rm(file, { force: true })
    await fs.rename(tmp, file)
  }
}

function isEnvelope(value: unknown): value is SnapshotEnvelope {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.version === "string" &&
    typeof v.generatedAt === "number" &&
    typeof v.data === "object" &&
    v.data !== null
  )
}

function createPointerStore(dataDir: string): VersionPointerStore {
  const currentFile = path.join(dataDir, "current.json")
  let chain = Promise.resolve()

  function serial<T>(task: () => Promise<T>): Promise<T> {
    const next = chain.then(task, task)
    chain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  async function readCurrent(): Promise<string | null> {
    const raw = (await readJson(currentFile)) as { releaseId?: unknown; version?: unknown } | null
    if (!raw) return null
    const id = raw.releaseId ?? raw.version
    return typeof id === "string" && id ? id : null
  }

  return {
    async getCurrent() {
      return serial(readCurrent)
    },
    async compareAndSwap(expected, next) {
      return serial(async () => {
        const current = await readCurrent()
        if (current !== expected) return false
        await writeJsonAtomic(currentFile, {
          releaseId: next,
          version: next,
          updatedAt: new Date().toISOString(),
        })
        return true
      })
    },
  }
}

export function createLocalSnapshotService(opts: LocalSnapshotOptions): LocalSnapshotService {
  const dataDir = path.resolve(opts.dataDir)
  const pointer = createPointerStore(dataDir)

  function versionFile(version: string): string {
    return path.join(dataDir, `snapshot-${version}.json`)
  }

  return {
    async current(): Promise<SnapshotEnvelope> {
      const releaseId = await pointer.getCurrent()
      if (!releaseId) throw new Error("尚无发布快照")
      const raw = await readJson(versionFile(releaseId))
      if (!isEnvelope(raw)) throw new Error(`快照 ${releaseId} 不存在或已损坏`)
      return raw
    },

    async publish(envelope: SnapshotEnvelope): Promise<string> {
      await fs.mkdir(dataDir, { recursive: true })
      const expected = await pointer.getCurrent()
      const outcome = await publishSnapshotWithCas({
        expected,
        next: envelope.version,
        store: pointer,
        writeVersionFile: async (version) => {
          const file = versionFile(version)
          let handle: FileHandle
          try {
            handle = await fs.open(file, "wx")
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === "EEXIST") {
              throw new Error(`版本文件已存在：${version}`)
            }
            throw err
          }
          try {
            await handle.writeFile(JSON.stringify(envelope, null, 2), "utf8")
            await handle.sync()
          } finally {
            await handle.close()
          }
        },
      })
      if (outcome.status === "conflict") {
        throw new Error(`发布版本冲突，当前版本已变为 ${outcome.current ?? "null"}`)
      }
      return outcome.version
    },
  }
}

/** 生成排序友好且不会碰撞的版本号。 */
export function createReleaseId(at = Date.now()): string {
  const iso = new Date(at).toISOString().replace(/[-:]/g, "").replace(/\..+$/, "")
  return `${iso}-${randomUUID().slice(0, 8)}`
}
