# Atalho: apenas executa o exe ja buildado (sem rebuild)
$exeRelease = Join-Path $PSScriptRoot "src-tauri\target\release\pokestats.exe"
$exeDebug = Join-Path $PSScriptRoot "src-tauri\target\debug\pokestats.exe"
if (Test-Path $exeRelease) { Start-Process $exeRelease; Write-Host "Executando $exeRelease" }
elseif (Test-Path $exeDebug) { Start-Process $exeDebug; Write-Host "Executando $exeDebug" }
else { Write-Host "Nenhum exe encontrado. Rode .\build-and-run.ps1 primeiro." -ForegroundColor Red }
