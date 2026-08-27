# PokeStats — build and run standalone em um clique
# Uso: powershell -ExecutionPolicy Bypass -File .\build-and-run.ps1
# Faz: pnpm install -> dataset:build -> pnpm build -> tauri build -> executa
$ErrorActionPreference = "Stop"

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $PSScriptRoot

# Garante cargo no PATH (rustup padrao)
$env:Path = "C:\Users\Yuuki\.cargo\bin;" + $env:Path

Write-Host "== PokeStats build-and-run ==" -ForegroundColor Cyan
Write-Host "Dir: $PSScriptRoot"

Write-Host "`n[1/4] pnpm install..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install falhou" }

Write-Host "`n[2/4] dataset:build (fixtures locais -> core.json + sets.json)..." -ForegroundColor Yellow
pnpm run dataset:build
if ($LASTEXITCODE -ne 0) { throw "dataset:build falhou" }

Write-Host "`n[3/4] vite build..." -ForegroundColor Yellow
pnpm run build
if ($LASTEXITCODE -ne 0) { throw "vite build falhou" }

# Usa build debug para iteracao rapida; troque para `pnpm tauri build` para release
$BuildMode = if ($args -contains "--release") { "release" } else { "debug" }

Write-Host "`n[4/4] tauri build --$BuildMode (standalone exe)..." -ForegroundColor Yellow
if ($BuildMode -eq "release") {
  pnpm exec tauri build
} else {
  pnpm exec tauri build --debug
}
if ($LASTEXITCODE -ne 0) { throw "tauri build falhou" }

# Localiza exe
$exeDebug = "src-tauri\target\debug\pokestats.exe"
$exeRelease = "src-tauri\target\release\pokestats.exe"
$exe = $null
if (Test-Path $exeRelease) { $exe = (Resolve-Path $exeRelease).Path }
elseif (Test-Path $exeDebug) { $exe = (Resolve-Path $exeDebug).Path }

if ($exe) {
  Write-Host "`nOK: $exe" -ForegroundColor Green
  Write-Host "Executando..." -ForegroundColor Cyan
  Start-Process $exe
} else {
  Write-Host "`nBuild terminou mas exe nao encontrado. Procure em src-tauri\target\{debug|release}\pokestats.exe ou em src-tauri\target\{debug|release}\bundle\" -ForegroundColor Red
  Get-ChildItem "src-tauri\target" -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object FullName, Length | Format-Table -AutoSize
}
