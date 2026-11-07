import { useCallback, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FilePlus2,
  FileUp,
  Globe,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useSiteStore, type EditableData } from "@/site/admin/store"
import { CollapsibleGroup, ObjectFields } from "@/site/admin/forms"
import {
  BLOCK_TYPE_LABELS,
  PAGE_TEMPLATES,
  createBlock,
  normalizePageImport,
  validatePageImport,
  type BlockType,
  type CustomPage,
  type PageBlock,
} from "@/site/data/pages"

/* ------------------------------------------------------------------ */
/* 页面管理（通用化核心）：                                              */
/* - 页面注册表：列出全部自定义页面，可新建（模板/AI/空白）、删除；      */
/* - 区块编排：每个页面 = 区块列表，可增删、排序、逐区块折叠编辑；      */
/* - 每个区块 id 即预览锚点（/pages/:slug/ 上 data-preview-anchor）；    */
/* - 修改进入草稿层，发布后前台 /pages/:slug/ 生效。                    */
/* ------------------------------------------------------------------ */

interface PreviewTarget {
  path: string
  anchor?: string
  groupAnchor?: string
}

export function PageManager({ onLocate }: { onLocate?: (t: PreviewTarget) => void }) {
  const { data, setSlice, sliceHasDraftChange } = useSiteStore()
  const pages = data.pages
  const [editingSlug, setEditingSlug] = useState<string | null>(pages[0]?.slug ?? null)
  const [showNew, setShowNew] = useState(false)
  const [importText, setImportText] = useState("")
  const [importError, setImportError] = useState("")

  const updatePages = (next: CustomPage[]) => {
    setSlice("pages", next as EditableData["pages"])
  }

  const upsertPage = (page: CustomPage) => {
    const idx = pages.findIndex((p) => p.slug === page.slug)
    const next = idx >= 0 ? [...pages.slice(0, idx), page, ...pages.slice(idx + 1)] : [...pages, page]
    updatePages(next)
    setEditingSlug(page.slug)
    setShowNew(false)
  }

  const removePage = (slug: string) => {
    if (!window.confirm(`删除页面「${slug}」？该操作写入草稿，发布后前台不再展示。`)) return
    updatePages(pages.filter((p) => p.slug !== slug))
    if (editingSlug === slug) setEditingSlug(null)
  }

  const editing = pages.find((p) => p.slug === editingSlug) ?? null

  /* ---------------- 主题归属/首页映射标识 ---------------- */

  /** 当前首页标识（theme.homePageSlug 指向该页） */
  const isCurrentHome = (p: CustomPage) => data.theme.homePageSlug === p.slug

  /* ---------------- 区块操作 ---------------- */

  const updateBlock = (page: CustomPage, i: number, block: PageBlock) => {
    const next = [...page.blocks]
    next[i] = block
    upsertPage({ ...page, blocks: next })
  }

  const moveBlock = (page: CustomPage, i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= page.blocks.length) return
    const next = [...page.blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    upsertPage({ ...page, blocks: next })
  }

  const addBlock = (page: CustomPage, type: BlockType) => {
    upsertPage({ ...page, blocks: [...page.blocks, createBlock(type)] })
  }

  const removeBlock = (page: CustomPage, i: number) => {
    const next = [...page.blocks]
    next.splice(i, 1)
    upsertPage({ ...page, blocks: next })
  }

  // 编辑某区块时定位预览（同路由直接高亮）
  const onEditBlock = useCallback(
    (page: CustomPage, blockId: string) => {
      onLocate?.({ path: `/pages/${page.slug}/`, anchor: blockId })
    },
    [onLocate]
  )

  /* ---------------- 新建：模板 / AI / 空白 ---------------- */

  const createFromTemplate = (tplId: string) => {
    const tpl = PAGE_TEMPLATES.find((t) => t.id === tplId)
    if (!tpl) return
    upsertPage({ ...tpl.page, slug: tpl.page.slug, title: tpl.page.title, origin: "template", blocks: tpl.page.blocks.map((b) => ({ ...b, id: `${tpl.id}-${b.id}` })) })
  }

  const importJson = () => {
    setImportError("")
    let parsed: unknown
    try {
      parsed = JSON.parse(importText)
    } catch {
      setImportError("JSON 解析失败，请检查格式。")
      return
    }
    const err = validatePageImport(parsed)
    if (err) {
      setImportError(err)
      return
    }
    const page = normalizePageImport(parsed as Record<string, unknown>)
    upsertPage({ ...page, origin: "imported", inNav: page.inNav ?? true })
    setImportText("")
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      {/* ---------------- 左侧：页面注册表 ---------------- */}
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-[13px] font-semibold">自定义页面（{pages.length}）</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            每个页面 = 一组区块。新建后发布，前台 /pages/slug/ 即生效。
            <span className="mt-0.5 block">
              点击「设为首页」后，首页（/ 路由）渲染该页面区块——自定义首页与二级页都能运营编辑。
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          {pages.map((p) => {
            const changed = sliceHasDraftChange("pages")
            const isHome = isCurrentHome(p)
            return (
              <div key={p.slug}>
                <button
                  type="button"
                  onClick={() => setEditingSlug(p.slug)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    editingSlug === p.slug
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <Globe className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium">{p.title}</span>
                      {isHome && (
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-px text-[10.5px] font-medium text-primary">
                          当前首页
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      /pages/{p.slug}/ · {p.blocks.length} 区块{changed ? " · 有草稿" : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
            )
          })}
        </div>

        {/* 新建入口 */}
        <div className="rounded-xl border border-border bg-card p-4">
          {!showNew ? (
            <Button variant="outline" className="w-full gap-1.5" onClick={() => setShowNew(true)}>
              <FilePlus2 className="size-4" />
              新建页面
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">新建页面</div>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setShowNew(false)} aria-label="关闭">
                  <X className="size-3.5" />
                </Button>
              </div>

              <div>
                <Label className="text-[12px] text-muted-foreground">模板（一键生成整页草稿）</Label>
                <div className="mt-1.5 space-y-1.5">
                  {PAGE_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => createFromTemplate(t.id)}
                      className="flex w-full items-start gap-2 rounded-lg border border-border px-3 py-2 text-left hover:border-primary/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium">{t.name}</span>
                        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
                          {t.desc}
                        </span>
                      </span>
                      <Plus className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/70 pt-3">
                <Label className="text-[12px] text-muted-foreground">
                  导入页面 JSON（模板导出的页面定义）
                </Label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={4}
                  placeholder={'{"slug":"my-page","title":"我的页面","blocks":[{"id":"b1","type":"hero","title":"…"}]}'}
                  className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60"
                />
                <div className="mt-1.5 flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={importJson}>
                    <FileUp className="size-3.5" />
                    校验并导入
                  </Button>
                  {importError && <span className="text-[11.5px] text-destructive">{importError}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- 右侧：页面编辑（区块编排） ---------------- */}
      <div className="min-w-0">
        {!editing ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Globe className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-[14px] font-medium">选择一个页面开始编辑</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              或在左侧从模板生成 / 导入 JSON。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[15px] font-bold">{editing.title}</div>
                    {isCurrentHome(editing) && (
                      <span className="rounded bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary">
                        当前首页（/ 路由渲染此页）
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">
                    /pages/{editing.slug}/ · {editing.blocks.length} 个区块
                    {editing.origin && ` · 来源：${editing.origin}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isCurrentHome(editing) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setSlice("theme", { ...data.theme, homePageSlug: editing.slug })}
                      title="发布后，首页 / 路由将渲染此页面区块"
                    >
                      <Globe className="size-3.5" />
                      设为首页
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onLocate?.({ path: `/pages/${editing.slug}/` })}
                  >
                    <Globe className="size-3.5" />
                    在预览中打开
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive"
                    onClick={() => removePage(editing.slug)}
                  >
                    <Trash2 className="size-3.5" />
                    删除页面
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Label className="text-[12px] text-muted-foreground">加入主导航</Label>
                <input
                  type="checkbox"
                  checked={!!editing.inNav}
                  onChange={(e) => upsertPage({ ...editing, inNav: e.target.checked })}
                  className="size-4 accent-primary"
                />
                <span className="text-[11.5px] text-muted-foreground">
                  勾选后显示在站点页头导航
                </span>
              </div>
            </div>

            {/* 区块列表 */}
            <div className="space-y-2">
              {editing.blocks.map((block, i) => {
                const t = block.type
                const hasTitle = "title" in block && block.title
                const title =
                  (block as { title?: string }).title ||
                  (block as { eyebrow?: string }).eyebrow ||
                  `${BLOCK_TYPE_LABELS[t]}（第 ${i + 1} 块）`
                return (
                  <CollapsibleGroup
                    key={block.id}
                    title={`${BLOCK_TYPE_LABELS[t]}${hasTitle ? " · " + title : ""}`}
                    summary={`区块 ${i + 1} · ${BLOCK_TYPE_LABELS[t]}`}
                    toolbar={
                      <span className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => moveBlock(editing, i, -1)}
                          disabled={i === 0}
                          aria-label="上移"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => moveBlock(editing, i, 1)}
                          disabled={i === editing.blocks.length - 1}
                          aria-label="下移"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          onClick={() => removeBlock(editing, i)}
                          aria-label="删除区块"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>
                    }
                    onToggle={(open) => open && onEditBlock(editing, block.id)}
                  >
                    {/* 排除 id/type，编辑业务字段 */}
                    <BlockFields
                      block={block}
                      onChange={(next) => updateBlock(editing, i, next)}
                    />
                  </CollapsibleGroup>
                )
              })}
            </div>

            {/* 添加区块 */}
            <div className="rounded-xl border border-dashed border-border bg-card p-3">
              <div className="text-[12px] font-medium text-muted-foreground">添加区块</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => addBlock(editing, bt)}
                    className="rounded-md border border-border px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    + {BLOCK_TYPE_LABELS[bt]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- 区块字段编辑 ---------------- */

/** 把区块的 id/type 排除，让 ObjectFields 编辑业务字段；onChange 合回 id/type。 */
function BlockFields({ block, onChange }: { block: PageBlock; onChange: (next: PageBlock) => void }) {
  const { id, type, ...rest } = block as PageBlock & Record<string, unknown>
  return (
    <ObjectFields
      value={rest as Record<string, unknown>}
      onChange={(next) => onChange({ id, type, ...next } as PageBlock)}
    />
  )
}
