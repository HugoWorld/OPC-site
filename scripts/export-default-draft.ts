import { ABOUT } from "@/site/data/about"
import {
  AUDIENCES,
  DEMOS,
  DEMO_VIDEOS,
  HERO,
  HOME_SECTIONS,
  PRODUCT_CAROUSEL,
  STATS,
  TESTIMONIALS,
  VALUE_PROPS,
} from "@/site/data/home"
import { FAQ_GROUPS, METHOD } from "@/site/data/method"
import { DEFAULT_PAGES } from "@/site/data/pages"
import { PRODUCTS } from "@/site/data/products"
import { SHARES } from "@/site/data/shares"
import {
  CTA,
  FOOTER_AIGC,
  FOOTER_BOUNDARY,
  FOOTER_COLUMNS,
  NAV,
  PAGE_SETTINGS,
  SITE,
} from "@/site/data/site"
import { SOLUTIONS } from "@/site/data/solutions"
import { ARTICLES, SAMPLES } from "@/site/data/writing"

const draft = {
  site: SITE,
  nav: NAV,
  cta: CTA,
  footerColumns: FOOTER_COLUMNS,
  footerBoundary: FOOTER_BOUNDARY,
  footerAigc: FOOTER_AIGC,
  hero: HERO,
  stats: STATS,
  valueProps: VALUE_PROPS,
  audiences: AUDIENCES,
  homeSections: HOME_SECTIONS,
  demos: DEMOS,
  demoVideos: DEMO_VIDEOS,
  productCarousel: PRODUCT_CAROUSEL,
  products: PRODUCTS,
  testimonials: TESTIMONIALS,
  shares: SHARES,
  solutions: SOLUTIONS,
  articles: ARTICLES,
  samples: SAMPLES,
  method: METHOD,
  faqGroups: FAQ_GROUPS,
  about: ABOUT,
  theme: {
    accent: "#ff5d01",
    accent2: "#8b5cf6",
    density: "normal",
    avatarUrl: "",
    avatarLetter: "H",
  },
  pageSettings: PAGE_SETTINGS,
  pages: DEFAULT_PAGES,
}

process.stdout.write(JSON.stringify(draft))
