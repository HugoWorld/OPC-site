import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Container } from "@/site/components/Layout"

/** 404 兜底页。 */
export function NotFoundPage() {
  return (
    <div className="px-6 py-24 md:px-8 md:py-32">
      <Container className="max-w-[560px] text-center">
        <div className="num text-[clamp(3.5rem,8vw,6rem)] font-extrabold tracking-[-0.04em] text-muted-foreground/30">
          404
        </div>
        <h1 className="text-gradient mt-4 text-[clamp(1.5rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] text-balance">
          这一页不存在
        </h1>
        <p className="mx-auto mt-4 max-w-[42ch] text-[14.5px] leading-relaxed text-muted-foreground text-pretty">
          可能是链接写错，也可能是内容还没发布。这里不会放「猜你感兴趣」的诱导链接，你大概率是想回首页。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="gap-2">
            <Link to="/">
              回首页
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/solutions/">看能做什么</Link>
          </Button>
        </div>
      </Container>
    </div>
  )
}
