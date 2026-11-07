import { Link } from "react-router-dom"
import { ArrowRight, FileSearch, ScanSearch, Workflow, Database } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Solution } from "@/site/data/solutions"

const ICONS = {
  bid: FileSearch,
  aigeo: ScanSearch,
  watchdog: Workflow,
  ontology: Database,
}

/** 模块卡：双动作（看详情 / 预约演示），主推有强调边。 */
export function SolutionCard({ solution }: { solution: Solution }) {
  const Icon = (ICONS as Record<string, typeof FileSearch>)[solution.id] ?? FileSearch
  const primary = solution.tier === "主推"

  return (
    <Card
      className={`group glass-card card-hover gap-0 overflow-hidden py-0 ${
        primary ? "border-primary/35 ring-accent" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="flex items-center gap-2 text-[13px] font-medium">{solution.title}</span>
        <Badge variant={primary ? "default" : "secondary"} className="font-normal">
          {solution.tier}
        </Badge>
      </div>
      <div className="p-5">
        <span
          className={`mb-4 grid size-9 place-items-center rounded-lg transition-colors group-hover:bg-primary group-hover:text-primary-foreground ${
            primary ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
          }`}
        >
          <Icon className="size-4.5" />
        </span>
        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{solution.subtitle}</h3>
        <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-muted-foreground">
          {solution.problem}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5">
            <Link to={`/solutions/${solution.id}/`}>
              看交付物与边界
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm" className="flex-1 gap-1.5">
            <Link to="/contact/">约演示</Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}
