import { Container } from "@/site/components/Layout"
import { useSiteData } from "@/site/admin/store"

/** 隐私政策：收集字段、保存期限、用途、联系方式。 */
export function PrivacyPage() {
  const { site } = useSiteData()
  return (
    <div className="px-6 py-14 md:px-8 md:py-20">
      <Container className="max-w-[720px]">
        <h1 className="text-gradient text-[clamp(1.9rem,4vw,2.9rem)] font-extrabold tracking-[-0.03em]">
          隐私政策
        </h1>
        <p className="mt-3 text-[13px] text-muted-foreground">更新日期：2026-11-01</p>

        <div className="mt-10 space-y-10 text-[14.5px] leading-[1.85] text-muted-foreground">
          <section>
            <h2 className="mb-3 text-[16px] font-semibold text-foreground">1. 我们收集什么</h2>
            <p>
              仅当你通过联系表单主动提交时，我们才会收集你填写的字段：称呼、公司/机构、所在城市、微信或手机、邮箱（选填）、想解决的环节、团队规模、期望启动时间、补充说明，以及来源渠道。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-semibold text-foreground">2. 用于什么</h2>
            <p>这些信息只用于：判断场景是否匹配、安排演示与上门拜访、回复你的咨询，以及统计转介绍占比（来源渠道字段，用于改进获客方式）。</p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-semibold text-foreground">3. 保存多久</h2>
            <p>
              未成交的咨询信息保留 12 个月后删除；成交客户的联系信息保留至合同关系结束后 2 年。你可以随时要求删除，联系方式见第 5 条。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-semibold text-foreground">4. 谁可以看到</h2>
            <p>
              仅本人（站点运营者）可访问。不会出售、出租或向无关第三方提供你的信息；合作方需要时（如部署实施）仅在必要范围内共享并约定保密。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[16px] font-semibold text-foreground">5. 如何联系我们</h2>
            <p>
              对隐私有任何问题、要更正或删除信息，发送邮件至
              <a href={site.emailHref} className="mx-1 text-primary hover:underline">{site.email}</a>
              ，我们会在 5 个工作日内回复。
            </p>
          </section>
        </div>
      </Container>
    </div>
  )
}
