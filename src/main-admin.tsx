import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { AdminApp } from "@/site/AdminApp"

/* 管理台入口（admin.html / admin 子域）：只有登录与工作台。 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="min-h-screen bg-background">
      <AdminApp />
    </div>
  </StrictMode>,
)
