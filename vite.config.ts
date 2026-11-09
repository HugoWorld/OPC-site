import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

/* ------------------------------------------------------------------ */
/* 双入口构建                                                          */
/* - `vite build`（mode=production）→ dist/       访客站 www 入口       */
/* - `vite build --mode admin`      → dist-admin/ 管理台 admin 入口     */
/* 两个入口只打包各自的路由，访客产物不含工作台与登录页。               */
/* ------------------------------------------------------------------ */

export default defineConfig(({ mode }) => {
  const admin = mode === "admin"
  return {
    // 相对路径构建：产物可直接双击 index.html 打开（file:// 也能加载资源）
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    build: {
      outDir: admin ? "dist-admin" : "dist",
      emptyOutDir: true,
      // 首屏预算：主包（站点代码）控制在 400 kB 以内，框架与工作台各自成块
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        // 单入口构建：访客只打 index.html，管理台只打 admin.html
        input: admin
          ? fileURLToPath(new URL("./admin.html", import.meta.url))
          : fileURLToPath(new URL("./index.html", import.meta.url)),
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return
            if (
              id.includes("react-dom") ||
              id.includes("react-router") ||
              id.includes("/react/") ||
              id.includes("\\react\\") ||
              id.includes("scheduler")
            ) {
              return "vendor-react"
            }
            if (id.includes("@radix-ui") || id.includes("lucide-react")) {
              return "vendor-ui"
            }
            return "vendor"
          },
        },
      },
    },
  }
})
