#!/usr/bin/env bash
# ============================================================
# 原型工作台 · 一键安装 (bash / Git Bash / WSL)
# 用法：bash ./scripts/setup.sh
#
# 注意：node_modules 已预装为 win32 原生包（esbuild / rollup / tailwind oxide /
#       lightningcss 均是 @*-win32-x64 版本）。请在本机 Windows（Git Bash / WSL
#       调用 Windows 版 node）上执行本脚本，不要在纯 Linux 沙箱里 npm install，
#       否则原生包会被替换成 linux 版本，本机 npm run dev 会失败。
# ============================================================
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

echo -e "\n==> 1/5  检查运行环境"
node_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [ "${node_major}" -lt 20 ]; then
  echo "  Node 版本过低（当前 $(node -v)），需要 >= 20" >&2
  exit 1
fi
echo "  Node $(node -v) / npm $(npm -v)"

echo -e "\n==> 2/5  安装 npm 依赖"
if [ -d "node_modules/@rollup/rollup-win32-x64-msvc" ]; then
  echo "  已存在 win32 原生包，跳过重装（如需强制重装先 rm -rf node_modules）"
else
  npm install
fi

echo -e "\n==> 3/5  补齐 shadcn 官方组件"
npx --yes shadcn@latest add --yes --overwrite \
  button card badge input textarea separator \
  dialog tabs tooltip sheet accordion dropdown-menu switch slider avatar label

echo -e "\n==> 4/5  注册 shadcn MCP"
if command -v claude >/dev/null 2>&1; then
  claude mcp add shadcn --scope project -- npx -y shadcn@latest mcp --stdio || \
    echo "  .mcp.json 已存在，跳过注册"
else
  echo "  未检测到 claude CLI；桌面端会自动读取本目录的 .mcp.json"
fi

echo -e "\n==> 5/5  启动开发服务器 http://localhost:5173"
npm run dev
