/* ------------------------------------------------------------------ */
/* 发布互斥：两层保护                                                   */
/*                                                                    */
/* 1. 进程内 keyed mutex：同一实例里两个发布请求不会交叉写表/写指针。    */
/* 2. 快照指针 CAS：多实例或云函数并发时，只有指针仍等于读到的版本才     */
/*    能切换；落后的一方拿到冲突，由前端提示「已有人发布，请刷新」。      */
/*                                                                    */
/* 版本文件先写、指针后切：CAS 失败最多留下一个没人引用的孤儿版本文件，  */
/* 不会出现 current.json 指向半份数据。                                  */
/* ------------------------------------------------------------------ */

/** 同一 key 的异步任务串行执行；不同 key 互不阻塞。 */
export function createKeyedMutex() {
  const tails = new Map<string, Promise<unknown>>()

  return function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve()
    const next = previous.then(task, task)
    // 队列尾部只用于排队，不把失败向上抛，避免一次失败卡死后续请求。
    tails.set(
      key,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )
    return next
  }
}

/** 快照指针的最小存储契约：读当前版本 + 原子比较并交换。 */
export interface VersionPointerStore {
  getCurrent(): Promise<string | null>
  /**
   * 当 current 仍等于 expected 时把指针写到 next。
   * 返回 true 表示切换成功；false 表示期间已被别人改过。
   * 真实实现应使用本机文件锁（独占创建 + 原子 rename），或对象存储的
   * 条件写；本项目的单机实现见 local-snapshot.ts。
   */
  compareAndSwap(expected: string | null, next: string): Promise<boolean>
}

export interface SnapshotPublishInput {
  /** 发布前读到的版本号；首次发布为 null */
  expected: string | null
  /** 本次发布的新版本号 */
  next: string
  store: VersionPointerStore
  /** 写不可变版本文件（必须在切指针之前完成） */
  writeVersionFile: (version: string) => Promise<void>
}

export type SnapshotPublishOutcome =
  | { status: "ok"; version: string }
  | { status: "conflict"; current: string | null }

export async function publishSnapshotWithCas(
  input: SnapshotPublishInput,
): Promise<SnapshotPublishOutcome> {
  await input.writeVersionFile(input.next)
  const swapped = await input.store.compareAndSwap(input.expected, input.next)
  if (swapped) return { status: "ok", version: input.next }
  return { status: "conflict", current: await input.store.getCurrent() }
}
