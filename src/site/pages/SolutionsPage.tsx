import { Section, SectionHead } from "@/site/components/Layout"
import { SolutionCard } from "@/site/components/SolutionCard"
import { sortSolutions, useSiteData } from "@/site/admin/store"

/** 能做什么：全部能力模块索引（页头标题/导语来自工作台「二级页页面设置」）。 */
export function SolutionsPage() {
  const { solutions, pageSettings } = useSiteData()
  const sorted = sortSolutions(solutions).filter((s) => s.published !== false)
  const ps = pageSettings.solutions
  return (
    <Section anchor="solutions" className="pt-16 md:pt-24">
      <SectionHead
        level="h1"
        title={ps.title}
        lead={ps.lead}
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {sorted.map((s) => (
          <SolutionCard key={s.id} solution={s} />
        ))}
      </div>
    </Section>
  )
}
