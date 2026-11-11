import { readFileSync, writeFileSync } from "node:fs"

const input = process.env.DRAFT_JSON ?? ""
const output = process.env.OUT_JSON ?? ""
const draft = JSON.parse(readFileSync(input, "utf8")) as Record<string, any>

/** 把打包时内联的 webp data URL 换回站内静态资源路径，避免把 base64 写进 Base。 */
for (const key of ["avatarUrl", "heroBgUrl"]) {
  const value = draft?.hero?.[key]
  if (typeof value === "string" && value.startsWith("data:image/webp;base64")) {
    draft.hero[key] =
      key === "avatarUrl"
        ? "/assets/hero-avatar-BAA_x3ku.webp"
        : "/assets/hero-bg-Dx1Lxuhq.webp"
  }
}

writeFileSync(output, JSON.stringify(draft))
