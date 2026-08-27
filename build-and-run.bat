@echo off
REM PokeStats — build and run (cmd)
REM Uso: build-and-run.bat [--release]
setlocal
set "PATH=C:\Users\Yuuki\.cargo\bin;%PATH%"
cd /d "%~dp0"

echo == PokeStats build-and-run ==
echo [1/4] pnpm install...
call pnpm install
if errorlevel 1 exit /b 1

echo [2/4] dataset:build...
call pnpm run dataset:build
if errorlevel 1 exit /b 1

echo [3/4] vite build...
call pnpm run build
if errorlevel 1 exit /b 1

echo [4/4] tauri build...
if "%~1"=="--release" (
  call pnpm exec tauri build
) else (
  call pnpm exec tauri build --debug
)
if errorlevel 1 exit /b 1

if exist "src-tauri\target\release\pokestats.exe" (
  echo OK: src-tauri\target\release\pokestats.exe
  start "" "src-tauri\target\release\pokestats.exe"
) else if exist "src-tauri\target\debug\pokestats.exe" (
  echo OK: src-tauri\target\debug\pokestats.exe
  start "" "src-tauri\target\debug\pokestats.exe"
) else (
  echo Build terminou mas exe nao encontrado
  dir /s /b src-tauri\target\*.exe
)
