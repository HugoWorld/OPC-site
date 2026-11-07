# ============================================================
# 原型工作台 · 一键安装 (Windows PowerShell)
# 用法：在本目录执行  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
#
# 注意：node_modules 已预装为 win32 原生包（esbuild / rollup / tailwind oxide /
#       lightningcss 均是 @*-win32-x64 版本）。重装请务必在本机 Windows 上跑，
#       不要在 Linux/macOS 沙箱里执行 npm install，否则原生包会被替换成
#       linux 版本，本机 npm run dev 会因「找不到 rollup native 模块」而失败。
# ============================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "`n==> 1/5  检查运行环境" -ForegroundColor Cyan
$nodeMajor = (node -v) -replace '^v(\d+).*$', '$1'
if ([int]$nodeMajor -lt 20) {
  Write-Host "  Node 版本过低（当前 $(node -v)），需要 >= 20" -ForegroundColor Red
  exit 1
}
Write-Host "  Node $(node -v) / npm $(npm -v)" -ForegroundColor DarkGray

Write-Host "`n==> 2/5  安装 npm 依赖" -ForegroundColor Cyan
if (Test-Path "node_modules\@rollup\rollup-win32-x64-msvc") {
  Write-Host "  已存在 win32 原生包，跳过重装（如需强制重装先删掉 node_modules）" -ForegroundColor DarkGray
} else {
  npm install
}

Write-Host "`n==> 3/5  补齐 shadcn 官方组件" -ForegroundColor Cyan
npx --yes shadcn@latest add --yes --overwrite `
  button card badge input textarea separator `
  dialog tabs tooltip sheet accordion dropdown-menu switch slider avatar label

Write-Host "`n==> 4/5  注册 shadcn MCP" -ForegroundColor Cyan
if (Get-Command claude -ErrorAction SilentlyContinue) {
  try {
    claude mcp add shadcn --scope project -- npx -y shadcn@latest mcp --stdio | Out-Null
    Write-Host "  shadcn MCP 已注册（项目级 .mcp.json）" -ForegroundColor Green
  } catch {
    Write-Host "  .mcp.json 已存在，跳过注册" -ForegroundColor DarkGray
  }
} else {
  Write-Host "  未检测到 claude CLI；桌面端会自动读取本目录的 .mcp.json" -ForegroundColor DarkGray
}

Write-Host "`n==> 5/5  启动开发服务器 http://localhost:5173" -ForegroundColor Green
npm run dev
