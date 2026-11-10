# ------------------------------------------------------------------
# 本地打包发布物（Windows PowerShell 7）
#
# 用法：pwsh ./deploy/make-release.ps1
# 产物：_release/hugow-release-<timestamp>.tar.gz 与 .sha256
#
# 只打包运行必需文件：双产物 + 网关源码 + 前端数据契约 + package.json
# + deploy 脚本。不会把 node_modules、截图、密钥打进发布包。
# ------------------------------------------------------------------
param(
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$prototype = Join-Path $root "prototype"
if (-not (Test-Path -LiteralPath (Join-Path $prototype "package.json"))) {
  throw "找不到 prototype/package.json，请从项目根执行"
}
if (-not $OutDir) { $OutDir = Join-Path $root "_release" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$staging = Join-Path $OutDir "staging-$stamp"
$tarPath = Join-Path $OutDir "hugow-release-$stamp.tar.gz"
$shaPath = "$tarPath.sha256"

Write-Host "[1/5] 构建双入口"
Push-Location $prototype
try {
  npm run build:all
  if ($LASTEXITCODE -ne 0) { throw "build:all 失败" }
} finally {
  Pop-Location
}

foreach ($p in @("dist\index.html", "dist-admin\admin.html", "src\server\main.ts")) {
  if (-not (Test-Path -LiteralPath (Join-Path $prototype $p))) {
    throw "构建产物缺失：prototype/$p"
  }
}

Write-Host "[2/5] 组装发布目录"
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $staging "gateway\src\site\admin") -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $prototype "dist") -Destination (Join-Path $staging "dist") -Recurse
Copy-Item -LiteralPath (Join-Path $prototype "dist-admin") -Destination (Join-Path $staging "dist-admin") -Recurse
Copy-Item -LiteralPath (Join-Path $prototype "src\server") -Destination (Join-Path $staging "gateway\src\server") -Recurse
Copy-Item -LiteralPath (Join-Path $prototype "src\site\admin\data") -Destination (Join-Path $staging "gateway\src\site\admin\data") -Recurse
Copy-Item -LiteralPath (Join-Path $prototype "package.json") -Destination (Join-Path $staging "gateway\package.json")
Copy-Item -LiteralPath (Join-Path $root "deploy") -Destination (Join-Path $staging "deploy") -Recurse

# 把 gateway/src 提升为发布包里的 src，deploy.sh 按 src/server 读取
Move-Item -LiteralPath (Join-Path $staging "gateway\src") -Destination (Join-Path $staging "src")
Move-Item -LiteralPath (Join-Path $staging "gateway\package.json") -Destination (Join-Path $staging "package.json")
Remove-Item -LiteralPath (Join-Path $staging "gateway") -Recurse -Force

Write-Host "[3/5] 打 tar.gz"
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$tarCmd = Get-Command tar -ErrorAction SilentlyContinue
$tarExe = if ($tarCmd) { $tarCmd.Source } else { Join-Path $env:SystemRoot "System32\tar.exe" }
if (-not (Test-Path -LiteralPath $tarExe)) { throw "找不到 tar；可改用 deploy/make-release.sh 在 Linux/WSL 打包" }
& $tarExe -czf $tarPath -C $staging .
if ($LASTEXITCODE -ne 0) { throw "tar 打包失败" }

Write-Host "[4/5] 计算 SHA256"
$hash = (Get-FileHash -LiteralPath $tarPath -Algorithm SHA256).Hash.ToLower()
"$hash  hugow-release-$stamp.tar.gz" | Set-Content -LiteralPath $shaPath -Encoding utf8

Write-Host "[5/5] 完成"
Get-Item -LiteralPath $tarPath, $shaPath |
  Select-Object Name, @{n = "MB"; e = { [math]::Round($_.Length / 1MB, 2) } }, FullName |
  Format-Table -AutoSize
