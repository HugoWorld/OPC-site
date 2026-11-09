/* ------------------------------------------------------------------ */
/* 访客入口压测（k6）                                                   */
/*                                                                    */
/* 目标：验证 www 入口在 CDN 后面的容量假设——首屏 p95 TTFB < 200ms、    */
/* 1,000 并发无 5xx。真实数字必须在目标 CDN/对象存储上跑，本地结果只作   */
/* 为回归基线。                                                        */
/*                                                                    */
/* 用法：                                                              */
/*   k6 run -e BASE_URL=https://www.example.com scripts/loadtest/visitor.k6.js */
/* ------------------------------------------------------------------ */

import http from "k6/http"
import { check, sleep } from "k6"
import { Trend, Rate } from "k6/metrics"

const ttfb = new Trend("first_screen_ttfb", true)
const failures = new Rate("first_screen_failures")

export const options = {
  scenarios: {
    // 日常峰值：50 QPS，持续 2 分钟
    steady: {
      executor: "constant-arrival-rate",
      rate: 50,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 100,
      maxVUs: 300,
      tags: { scenario: "steady" },
    },
    // 突发：1,000 人同时打开首屏
    burst: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 1000 },
        { duration: "60s", target: 1000 },
        { duration: "30s", target: 0 },
      ],
      startTime: "2m30s",
      tags: { scenario: "burst" },
    },
  },
  thresholds: {
    first_screen_ttfb: ["p(95)<200"],
    first_screen_failures: ["rate<0.001"],
    http_req_failed: ["rate<0.001"],
  },
}

const BASE = __ENV.BASE_URL || "http://localhost:4173"

export default function () {
  const res = http.get(`${BASE}/`, {
    tags: { name: "home" },
    headers: { "accept-encoding": "gzip, br" },
  })
  ttfb.add(res.timings.waiting)
  failures.add(!check(res, { "home 200": (r) => r.status === 200 }))

  // 首屏还依赖入口 JS 与样式；版本化资源应命中 CDN，回源只发生在冷启动。
  const scripts = res.html().find("script[src]")
  scripts.each((_, el) => {
    const src = el.getAttribute("src")
    if (src && src.endsWith(".js")) {
      const asset = http.get(`${BASE}/${src.replace(/^\.?\//, "")}`, {
        tags: { name: "entry-js" },
      })
      check(asset, { "asset 200": (r) => r.status === 200 })
    }
  })

  sleep(1)
}
