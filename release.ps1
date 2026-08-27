# PokeStats — gera o release de verdade (exe standalone + instaladores)
# Uso: powershell -ExecutionPolicy Bypass -File .\release.ps1
# Faz: checa versoes -> pnpm install --frozen-lockfile -> dataset:build -> pnpm build -> tauri build (release)
# Nao executa o app no fim; artefatos listados ao terminar.
$ErrorActionPreference = "Stop"

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $PSScriptRoot

# Garante cargo no PATH (rustup padrao)
$env:Path = "C:\Users\Yuuki\.cargo\bin;" + $env:Path

Write-Host "== PokeStats release ==" -ForegroundColor Cyan
Write-Host "Dir: $PSScriptRoot"

# Versoes devem bater entre package.json, tauri.conf.json e Cargo.toml
$pkgVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$confVersion = (Get-Content src-tauri\tauri.conf.json -Raw | ConvertFrom-Json).version
$cargoVersion = ((Get-Content src-tauri\Cargo.toml | Select-String '^version\s*=\s*"(.+)"').Matches[0].Groups[1].Value)
if ($pkgVersion -ne $confVersion -or $pkgVersion -ne $cargoVersion) {
  throw "Versoes divergem: package.json=$pkgVersion tauri.conf.json=$confVersion Cargo.toml=$cargoVersion. Alinhe antes de releasear"
}
Write-Host "`n[0/4] Versoes OK: $pkgVersion" -ForegroundColor Yellow

Write-Host "`n[1/4] pnpm install --frozen-lockfile..." -ForegroundColor Yellow
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "pnpm install falhou" }

Write-Host "`n[2/4] dataset:build (fixtures commitados, offline)..." -ForegroundColor Yellow
pnpm run dataset:build
if ($LASTEXITCODE -ne 0) { throw "dataset:build falhou" }

Write-Host "`n[3/4] pnpm build (tsc + vite)..." -ForegroundColor Yellow
pnpm run build
if ($LASTEXITCODE -ne 0) { throw "vite build falhou" }

Write-Host "`n[4/4] tauri build (release, exe + instaladores)..." -ForegroundColor Yellow
pnpm exec tauri build
if ($LASTEXITCODE -ne 0) { throw "tauri build falhou" }

Write-Host "`n== Artefatos ==" -ForegroundColor Cyan
$artifacts = @(
  "src-tauri\target\release\pokestats.exe",
  "src-tauri\target\release\bundle\nsis",
  "src-tauri\target\release\bundle\msi"
)
foreach ($a in $artifacts) {
  if (Test-Path $a) {
    Get-Item $a | ForEach-Object {
      if ($_.PSIsContainer) {
        Get-ChildItem $_ -File | ForEach-Object { "{0,10:N1} MB  {1}" -f ($_.Length / 1MB), $_.FullName }
      } else {
        "{0,10:N1} MB  {1}" -f ($_.Length / 1MB), $_.FullName
      }
    }
  }
}
Write-Host "`nRelease concluido: v$pkgVersion" -ForegroundColor Green
