import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  // 相对路径构建：dist 产物可直接双击 index.html 打开（file:// 也能加载资源）
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
    // 首屏预算：主包（站点代码）控制在 400 kB 以内，框架与工作台各自成块
    chunkSizeWarningLimit: 600,
    rollupOptions: {
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
})
