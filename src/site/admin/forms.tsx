import { useRef, useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, ImageOff, Link2, Plus, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/* ------------------------------------------------------------------ */
/* 运营工作台通用表单控件：分组可折叠 + 递归编辑任意 JSON 结构。         */
/* 每个模块按「组」组织：对象按顶层字段分组、数组按项分组，             */
/* 组头显示标题 + 摘要，点击展开/收起，展开后编辑内部字段。              */
/* ------------------------------------------------------------------ */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  textarea,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  if (textarea) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
      />
    )
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      {label ? <span className="text-[12.5px] text-muted-foreground">{label}</span> : null}
    </button>
  )
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

const LABEL_MAP: Record<string, string> = {
  id: "标识",
  slug: "标识",
  title: "标题",
  subtitle: "副标题",
  lead: "导语",
  note: "补充说明",
  eyebrow: "眉标",
  desc: "描述",
  summary: "摘要",
  takeaway: "结论",
  date: "日期",
  tags: "标签",
  modules: "关联模块",
  category: "分类",
  status: "状态",
  label: "名称",
  href: "跳转链接",
  value: "数值",
  hint: "口径说明",
  period: "时间段",
  duration: "周期",
  deliverable: "交付物",
  for: "适合谁",
  includes: "包含",
  price: "价格",
  name: "名称",
  items: "条目",
  steps: "步骤",
  rows: "行",
  windowTitle: "窗口标题",
  progress: "进度",
  variant: "样式",
  meta: "元信息",
  q: "问题",
  a: "回答",
  heading: "小标题",
  paragraphs: "段落",
  table: "表格",
  capabilities: "能力清单",
  deliverables: "交付物",
  boundaries: "边界",
  stack: "技术栈",
  audience: "适合人群",
  problem: "解决什么问题",
  demo: "演示",
  proof: "证据",
  order: "排序",
  published: "上架",
  statusNote: "状态说明",
  process: "交付流程",
  tiers: "合作方式",
  notpromise: "不承诺",
  timeline: "履历时间线",
  beliefs: "工作原则",
  intro: "自我介绍",
  stepsZh: "步骤",
  ctaText: "按钮文案",
  ctaHref: "按钮链接",
  buttonText: "按钮文案",
  buttonHref: "按钮链接",
  question: "问题",
  answer: "回答",
  time: "时间",
  column: "栏",
  columns: "多栏",
  avatarUrl: "头像图",
  heroBgUrl: "头像区背景图",
  coverUrl: "封面图",
  wechatQrUrl: "微信二维码图",
  wechatQrCaption: "二维码说明",
  qrUrl: "公众号二维码图",
  qrCaption: "二维码说明",
  videoUrl: "视频链接",
  videoName: "视频标题",
  githubUrl: "GitHub 链接",
  githubLabel: "GitHub 按钮文字",
  bubble: "气泡语",
  topic: "主题",
  author: "作者",
  durationText: "时长",
  productName: "关联产品",
}

export function prettyLabel(key: string) {
  return LABEL_MAP[key] ?? key
}

/** 取数组项/对象组的摘要文本（组头展示用）。 */
function summarize(v: unknown): string {
  if (typeof v === "string") return v.length > 40 ? v.slice(0, 40) + "…" : v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  if (Array.isArray(v)) return `共 ${v.length} 项`
  if (isPlainObject(v)) {
    const first = Object.entries(v).find(([, val]) => typeof val === "string" && val.length > 0)
    return first ? summarize(first[1]) : ""
  }
  return ""
}

/** 数组项/对象组的展示标题。 */
function groupTitle(v: unknown): string {
  if (isPlainObject(v)) {
    const t = v.title ?? v.name ?? v.label ?? v.q ?? v.heading
    if (typeof t === "string" && t) return t
  }
  return ""
}

/* ---------------- 可折叠组 ---------------- */

export function CollapsibleGroup({
  title,
  summary,
  defaultOpen = false,
  toolbar,
  onToggle,
  children,
}: {
  title: string
  summary?: string
  defaultOpen?: boolean
  toolbar?: ReactNode
  onToggle?: (open: boolean) => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = open
  const toggle = () => {
    const next = !isOpen
    setOpen(next)
    onToggle?.(next)
  }
  return (
    <div
      className={`rounded-lg border bg-card transition-colors ${
        isOpen ? "border-primary/40" : "border-border hover:border-border/80"
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
      >
        {isOpen ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold">{title}</span>
          {summary && !isOpen && (
            <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
        {toolbar}
      </button>
      {isOpen && <div className="border-t border-border/70 px-3.5 pt-3 pb-3.5">{children}</div>}
    </div>
  )
}

/* ---------------- 分组编辑器 ---------------- */

export type GroupedEditorProps = {
  label?: string
  value: unknown
  onChange: (next: unknown) => void
  /** 编辑某组时回调（预览定位用） */
  onEditGroup?: (groupKey: string) => void
  /** 数组是否允许增删（默认 true） */
  allowListOps?: boolean
  /** 空数组添加一项时使用的字段模板（无模板时按首项结构生成） */
  listSeed?: Record<string, unknown>
}

/**
 * 分组编辑器：
 * - 对象 → 每个顶层字段一个可折叠组；
 * - 数组（对象数组）→ 每项一个可折叠组 + 增删；
 * - 数组（基本类型）→ 行内编辑；
 * - 叶子值 → 直接输入。
 */
export function GroupedEditor({
  label,
  value,
  onChange,
  onEditGroup,
  allowListOps = true,
  listSeed,
}: GroupedEditorProps) {
  const name = label ?? "内容"

  // 叶子值（字符串 / 数字 / 布尔）
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <ScalarField label={name} value={value} onChange={onChange} />
  }

  // 基本类型数组（空数组且有 listSeed 模板时不走这里，按对象数组处理）
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => !isPlainObject(v) && !Array.isArray(v))
  ) {
    return <PrimitiveList label={name} value={value} onChange={onChange} />
  }

  // 对象数组 → 每项一组
  if (Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {(value as Record<string, unknown>[]).map((item, i) => {
          const t = groupTitle(item) || `第 ${i + 1} 项`
          return (
            <CollapsibleGroup
              key={i}
              title={t}
              summary={summarize(item)}
              toolbar={
                allowListOps ? (
                  <span className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => {
                        const next = [...(value as unknown[])]
                        next.splice(i, 1)
                        onChange(next)
                      }}
                      aria-label="删除"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                ) : null
              }
              onToggle={(open) => open && onEditGroup?.(String(i))}
            >
              <ObjectFields
                value={item}
                onChange={(next) => {
                  const arr = [...(value as unknown[])]
                  arr[i] = next
                  onChange(arr)
                }}
                onEditGroup={onEditGroup}
              />
            </CollapsibleGroup>
          )
        })}
        {allowListOps && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const seed =
                listSeed ??
                Object.keys(value[0] ?? {}).reduce<Record<string, unknown>>(
                  (acc, k) => ({ ...acc, [k]: "" }),
                  {}
                )
              onChange([...value, seed])
            }}
          >
            <Plus className="size-3.5" />
            添加一项
          </Button>
        )}
      </div>
    )
  }

  // 对象 → 顶层字段分组
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
    return (
      <div className="space-y-2">
        {entries.map(([k, v]) => {
          const isGroupable = isPlainObject(v) || (Array.isArray(v) && v.every(isPlainObject))
          if (!isGroupable) {
            return (
              <div key={k} className="rounded-lg border border-border bg-card px-3.5 py-3">
                <ObjectFields
                  value={{ [k]: v }}
                  onChange={(next) => onChange({ ...value, ...next })}
                  onEditGroup={onEditGroup}
                />
              </div>
            )
          }
          const t = groupTitle(v) || prettyLabel(k)
          return (
            <CollapsibleGroup
              key={k}
              title={t}
              summary={summarize(v)}
              onToggle={(open) => open && onEditGroup?.(k)}
            >
              <ObjectFields
                value={v as Record<string, unknown>}
                onChange={(next) => onChange({ ...value, [k]: next })}
                onEditGroup={onEditGroup}
              />
            </CollapsibleGroup>
          )
        })}
      </div>
    )
  }

  return (
    <Field label={name}>
      <Input value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

/* ---------------- 标量字段 ---------------- */

/** URL 类字段：图片支持「本地上传 / 粘贴链接」；普通链接字段只填链接。 */
function UrlField({
  label,
  value,
  onChange,
  kind,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  kind: "image" | "link"
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [tooLarge, setTooLarge] = useState(false)
  const isImage = kind === "image"
  const hasValue = Boolean(value)

  const pickFile = () => fileRef.current?.click()

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith("image/")) return
    // 头像/封面/背景图内嵌进草稿（localStorage 有容量上限，限制单张 1.5MB）
    if (file.size > 1.5 * 1024 * 1024) {
      setTooLarge(true)
      return
    }
    setTooLarge(false)
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result ?? ""))
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px] text-muted-foreground">{label}</Label>
      {isImage ? (
        <div className="flex items-center gap-3">
          {hasValue ? (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border">
              <img
                src={value}
                alt="预览"
                className="size-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLImageElement).style.opacity = "0.12"
                }}
              />
            </div>
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground">
              <ImageOff className="size-4" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Input
              value={value.startsWith("data:") ? "（本地上传图片，已内嵌保存）" : value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="粘贴图片链接，或点击右侧上传"
              className="text-[12.5px]"
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={pickFile}>
                <Upload className="size-3.5" />
                上传图片
              </Button>
              {hasValue ? (
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => onChange("")}>
                  清除
                </Button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>
            {tooLarge ? (
              <p className="text-[11.5px] text-destructive">图片超过 1.5MB，请压缩后重试或改用链接。</p>
            ) : null}
            <p className="text-[11.5px] text-muted-foreground/70">
              支持本地上传（内嵌保存，建议 1MB 内）或粘贴图片链接；前台圆形裁切展示，建议用正方形图。
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="粘贴视频链接（https://… 或 /videos/xxx.mp4）"
              className="text-[12.5px]"
            />
          </div>
          <p className="text-[11.5px] text-muted-foreground/70">
            原型阶段支持外部链接或项目内相对路径；如需上传本地视频文件，请放到原型 public/videos/ 目录后填相对路径。
          </p>
        </div>
      )}
    </div>
  )
}

function ScalarField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | number | boolean
  onChange: (next: unknown) => void
}) {
  if (typeof value === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
        <span className="text-[12.5px] text-muted-foreground">{label}</span>
        <Toggle checked={value} onChange={(v) => onChange(v)} />
      </div>
    )
  }
  if (typeof value === "number") {
    return (
      <Field label={label}>
        <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </Field>
    )
  }
  // URL 类字段：图片/链接二选一（上传或绑定）
  if (/^(头像图|头像区背景图|封面图|微信二维码图|公众号二维码图)$/.test(label)) {
    return <UrlField label={label} value={value} onChange={(v) => onChange(v)} kind="image" />
  }
  if (/^(视频链接)$/.test(label)) {
    return <UrlField label={label} value={value} onChange={(v) => onChange(v)} kind="link" />
  }
  return (
    <Field label={label}>
      <TextInput value={value} onChange={(v) => onChange(v)} textarea={value.length > 80} />
    </Field>
  )
}

/* ---------------- 基本类型数组 ---------------- */

function PrimitiveList({
  label,
  value,
  onChange,
}: {
  label: string
  value: unknown[]
  onChange: (next: unknown) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-[12.5px] text-muted-foreground">{label}</div>
      <div className="space-y-1.5">
        {value.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={String(v)}
              onChange={(e) => {
                const next = [...value]
                next[i] = typeof value[0] === "number" ? Number(e.target.value) : e.target.value
                onChange(next)
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-destructive"
              onClick={() => {
                const next = [...value]
                next.splice(i, 1)
                onChange(next)
              }}
              aria-label="删除"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const seed = typeof value[0] === "number" ? 0 : ""
            onChange([...value, seed])
          }}
        >
          <Plus className="size-3.5" />
          添加
        </Button>
      </div>
    </div>
  )
}

/* ---------------- 对象字段递归 ---------------- */

export function ObjectFields({
  value,
  onChange,
  onEditGroup,
}: {
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  onEditGroup?: (groupKey: string) => void
}) {
  const entries = Object.entries(value)
  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => (
        <GroupedEditor
          key={k}
          label={prettyLabel(k)}
          value={v}
          onChange={(next) => onChange({ ...value, [k]: next })}
          onEditGroup={onEditGroup}
        />
      ))}
    </div>
  )
}

