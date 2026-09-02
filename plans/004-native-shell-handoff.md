# Plan 004: Show the native shell within ~60 ms and never show a black WebView frame

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 0b6331f..HEAD -- src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/tauri.conf.json src/App.tsx src/routes/dex.tsx index.html`
> This plan was written against an **uncommitted working tree** on top of
> `0b6331f` (the maintainer had local edits in `src-tauri/src/lib.rs`,
> `src/App.tsx`, `index.html`). The drift check therefore cannot be trusted on
> its own: **compare every "Current state" excerpt below against the live
> code before proceeding**; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M (Phase A: S, Phase B: M)
- **Risk**: MED (Phase A LOW, Phase B MED — uses Tauri's `unstable` feature)
- **Depends on**: none
- **Category**: perf
- **Planned at**: working tree over commit `0b6331f`, 2026-09-01

## Why this matters

The maintainer's complaint is "the exe opens fast but the screen takes long,
and at some point the whole window is black". A screen-capture probe of the
release build (`src-tauri/target/release/pokestats.exe`, warm start, this
machine) shows exactly that, in three phases:

| t (ms) | What is on screen | Why (verified in code) |
|---|---|---|
| 0 → ~300 | **Nothing.** The window rect shows the desktop behind it. | Tauri creates the config window *and its WebView2* before `setup` runs. wry blocks the main thread pumping messages while WebView2's environment + controller are created (~250 ms). Our GDI shell is painted from `setup`, so the first shell pixels are only possible at ~300 ms. |
| ~300 → ~380 | GDI shell (sidebar text visible, no list). | `setup` runs: `hide_child_windows` + `paint_shell`. |
| ~380 → ~520-620 | **Solid black.** | `PageLoadEvent::Finished` calls `show_child_windows`. WebView2's compositor has not produced its first frame yet, so the shown child is black until ~550 ms when React's first full frame lands. |
| ~520-620 | Real UI. | |

Two fixes, independent of each other, both in this plan:

- **Phase A — hold the WebView until it has a real frame.** Show the WebView
  child only when the page tells us (via a Tauri command) that content is
  painted, with a timeout fallback. Removes the black phase completely.
- **Phase B — create the window before the WebView.** With Tauri's `unstable`
  feature, `setup` can build a bare `Window` first, paint the shell into it
  (via a proper `WM_PAINT` subclass), and only then attach the webview with
  `Window::add_child`. The shell then appears at ~40–60 ms instead of ~300 ms.

After both phases the user sees: window with sidebar/tabs/search chrome almost
immediately → the same chrome, now live, fills with the list ~0.5 s later, no
black in between. The WebView2 floor (~300 ms init + ~150 ms first frame)
cannot be removed by application code; Plan 005 shortens what happens after it.

## Current state

Files and roles:

- `src-tauri/src/lib.rs` — Tauri `run()`, caption colors, and the `winpaint`
  module (GDI shell, child hide/show, 16 ms repaint timer).
- `src-tauri/Cargo.toml` — `tauri = { version = "2.11.3", features = [] }`;
  no `unstable` feature; no `[profile.release]` (Plan 005 owns that).
- `src-tauri/tauri.conf.json` — one config window (`visible: true`,
  `backgroundColor: "#0a0a0a"`, `theme: "Dark"`, 1280×800, min 1024×640).
- `src-tauri/capabilities/default.json` — `windows: ["main"]`, permissions
  `core:default`, `core:window:allow-show`, `core:window:allow-set-focus`.
- `src/App.tsx` — router + providers; has a `[perf] first paint` `console.log`
  in `App`'s effect (lines 188–199).
- `src/routes/dex.tsx` — Dex list; the virtualized scroller is
  `<div ref={parentRef} className={cn("flex-1 overflow-auto", ...)}>` at line 495.
- `index.html` — inline boot skeleton (`.boot-aside` 200 px, `.boot-head`
  48 px, `.boot-tabs` 36 px, `.boot-search`), matching the GDI shell geometry.
- `package.json` — `@tauri-apps/api` `^2.6.0` is already a dependency (not yet
  imported anywhere in `src/`).

Excerpt — current `run()` (setup runs *after* the config window+webview exist):

```7:31:src-tauri/src/lib.rs
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      if let Some(win) = app.get_webview_window("main") {
        apply_caption(&win);
        let _ = win.show();
        let _ = win.set_focus();
        #[cfg(target_os = "windows")]
        if let Ok(hwnd) = win.hwnd() {
          let hwnd = hwnd.0 as isize;
          hide_child_windows(hwnd);
          paint_shell(hwnd);
          start_paint_timer(hwnd);
        }
      }
      Ok(())
    })
```

Excerpt — the reveal happens on `Finished`, before the compositor has a frame:

```32:57:src-tauri/src/lib.rs
    .on_page_load(|webview, payload| {
      let url = payload.url().as_str();
      if url.starts_with("about:") {
        return;
      }
      #[cfg(target_os = "windows")]
      {
        let Some(win) = webview.app_handle().get_webview_window("main") else {
          return;
        };
        let Ok(hwnd) = win.hwnd() else {
          return;
        };
        let hwnd = hwnd.0 as isize;
        match payload.event() {
          PageLoadEvent::Started => {
            if !WEBVIEW_READY.load(Ordering::SeqCst) {
              hide_child_windows(hwnd);
              paint_shell(hwnd);
            }
          }
          PageLoadEvent::Finished => {
            WEBVIEW_READY.store(true, Ordering::SeqCst);
            show_child_windows(hwnd);
          }
        }
      }
```

Excerpt — 16 ms timer repaints with a freshly created font every tick:

```175:186:src-tauri/src/lib.rs
  unsafe extern "system" fn on_paint_timer(hwnd: isize, _: u32, id: usize, _: u32) {
    if WEBVIEW_READY.load(Ordering::SeqCst) {
      KillTimer(hwnd, id);
      return;
    }
    paint_shell(hwnd);
  }

  pub fn start_paint_timer(hwnd: isize) {
    unsafe {
      SetTimer(hwnd, 1, 16, Some(on_paint_timer));
    }
  }
```

Excerpt — `paint_shell` acquires its own DC (lines 210–282). It draws:
client fill `#0a0a0a`, sidebar `#000` 200 px wide with a 1 px `#2e2e2e`
right border, a 48 px header with "PokeStats" / "v2", nine nav labels
(Dex … Settings), a 36 px tab strip with a "Dex" tab, and a 36 px search box
at `#1a1a1a`. Keep this drawing; only change *when* and *through which HDC* it runs.

Facts verified in dependency sources (do not re-derive; trust these):

- `tao 0.35.3` handles `WM_PAINT` by emitting `RedrawRequested` and falling
  through to `DefSubclassProc` (validates, paints nothing) and `WM_ERASEBKGND`
  by filling `background_color`. tao registers its own comctl32 subclass, so a
  second `SetWindowSubclass` from our code chains in front of it.
- `wry 0.55.1` creates a child HWND of class `WRY_WEBVIEW` with `WS_VISIBLE`
  **before** the WebView2 controller exists, then blocks in
  `webview2_com::wait_with_pump` (a `GetMessage`/`DispatchMessage` loop —
  timers and `WM_PARENTNOTIFY` are delivered during that wait).
- `tauri 2.11.5`: `tauri::window::WindowBuilder` and `Window::add_child` are
  behind the `unstable` cargo feature. `WebviewBuilder::auto_resize()` makes a
  child webview follow the window size. `Builder::on_page_load` receives a
  `Webview`; `webview.window()` returns its `Window`, which has `.hwnd()`.
- Application-defined `#[tauri::command]`s need no capability entry.

Conventions to match:

- Rust: 2-space indentation, `#[cfg(target_os = "windows")]` around Win32
  code, raw `extern "system"` declarations in the `winpaint` module (no
  `windows` crate dependency — keep it that way, do not add crates).
- TypeScript: existing `[perf]` console logs in `src/App.tsx`; `@/` alias.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Rust check | `cargo check --manifest-path src-tauri/Cargo.toml` | exit 0 |
| Typecheck | `pnpm exec tsc -b --pretty false` | exit 0 |
| Tests | `pnpm test` | all pass (106 today) |
| Lint | `pnpm lint` | exit 0 |
| Release build (ship gate) | `powershell -ExecutionPolicy Bypass -File .\release.ps1` | exit 0, prints artifact list |
| Startup probe | `powershell -ExecutionPolicy Bypass -File .\tools\perf\startup-probe.ps1 -Runs 5` | prints one `SUMMARY` line per run (created in Step 1) |

`release.ps1` takes several minutes (Rust release build). Run it at the end of
each phase, not after every step. `cargo check` is the fast gate for Rust edits.

## Scope

**In scope**:

- `tools/perf/startup-probe.ps1` (create)
- `src-tauri/src/lib.rs`
- `src-tauri/Cargo.toml` (Phase B only: add `unstable` feature)
- `src-tauri/tauri.conf.json` (Phase B only: `app.windows` → `[]`)
- `src/lib/boot/shellReady.ts` (create)
- `src/App.tsx` (call the ready signal)
- `src/routes/dex.tsx` (one `data-boot-content` attribute)
- `plans/README.md` (status)

**Out of scope**:

- `index.html` skeleton, `src/components/layout/Shell.tsx` — geometry already
  matches the GDI shell; do not restyle.
- `src-tauri/capabilities/default.json` — unless Step 3's STOP condition about
  "command not allowed" fires (then add the permission and note it).
- `[profile.release]` in `Cargo.toml` — Plan 005.
- Any change to dataset loading, sprites, or routes beyond the one attribute.
- macOS/Linux behavior: keep every Win32 call behind `#[cfg(target_os = "windows")]`
  exactly as today; non-Windows builds must still compile (`let _ = ...` stubs).

## Git workflow

- Branch: `advisor/004-native-shell-handoff` (repo uses `type/NN-slug`, e.g.
  `fix/44-cargo-toml-version`; either is acceptable).
- Commit per phase. Messages in the repo style, e.g.
  `perf(tauri): hold webview until first painted frame` and
  `perf(tauri): create window before webview so the shell paints at once`.
- Do NOT push or open a PR unless the operator instructed it.

## Target design

```
process start
  │ setup(): [Phase B] WindowBuilder::new("main").build()  ─► HWND exists (~20-40 ms)
  │          winpaint::install(hwnd): SetWindowSubclass + 50 ms safety timer + RedrawWindow
  │          ─► WM_ERASEBKGND / WM_PAINT paint the GDI shell (DWM presents first frame ~40-60 ms)
  │          window.add_child(WebviewBuilder::new("main", default).auto_resize(), 0,0, size)
  │              └─ wry creates WRY_WEBVIEW child (WS_VISIBLE) ─► our WM_PARENTNOTIFY hides it at once
  │              └─ wry pumps messages ~250 ms while WebView2 initializes; shell stays painted
  │ on_page_load Started  : nothing new (children already hidden)
  │ on_page_load Finished : PAGE_FINISHED = true; SetTimer(TIMER_FALLBACK, 2500 ms)
  │ JS: dataset ready → Dex list committed → 2× rAF → invoke("shell_ready")
  │ Rust command shell_ready → run_on_main_thread(reveal("js"))
  │ reveal(): WEBVIEW_READY=true; KillTimer ×2; RemoveWindowSubclass; ShowWindow(children, SW_SHOW)
  └ (if no signal 2.5 s after Finished: reveal("fallback"))
```

State: keep the existing `static WEBVIEW_READY: AtomicBool`; add
`static PAGE_FINISHED: AtomicBool` and `static BOOT_START: OnceLock<Instant>`.

## Steps

### Step 1: Add the startup probe (measurement first)

Create `tools/perf/startup-probe.ps1` with the content below. It launches the
release exe N times, samples the window every ~30 ms with `CopyFromScreen`,
and classifies frames with three pixel metrics:

- `sideDark` — fraction of sampled pixels in the sidebar body (x < 200,
  48 ≤ y < 420) that are near-black (all channels ≤ 12). The shell and the
  real UI both have a `#000` sidebar → ≥ 0.7. The desktop behind an
  unpresented window normally does not.
- `sideLight` — fraction of pixels in the header (x < 200, y < 48) with a
  channel > 180 → the "PokeStats" text. Shell or UI → > 0.01.
- `contentColor` — saturated pixels in the content area (x > 230, y > 170) →
  type badges of the Dex list → UI present when > 0.004.
- `nonBlack` — fraction of all sampled pixels with any channel > 20.
  A frame with `nonBlack < 0.005` is a **black frame**.

Per run it prints `SUMMARY run=N shell=<ms> ui=<ms> blackFrames=<count> firstBlackAt=<ms|->`
where `shell` is the first sample with `sideDark ≥ 0.7 && sideLight > 0.01`,
`ui` the first sample with `contentColor > 0.004 && sideDark ≥ 0.7`, and
`blackFrames` counts samples after `shell` with `nonBlack < 0.005`.

```powershell
param(
  [int]$Runs = 3,
  [int]$MaxMs = 4000,
  [int]$StepMs = 30,
  [string]$Exe = (Join-Path $PSScriptRoot "..\..\src-tauri\target\release\pokestats.exe"),
  [string]$FramesDir = ""
)
Add-Type -AssemblyName System.Drawing
$src = @"
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class PsProbe {
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X,Y; }
  public static string Measure(IntPtr h, string savePath) {
    RECT rc; GetClientRect(h, out rc); POINT p = new POINT(); ClientToScreen(h, ref p);
    int w = rc.R - rc.L, hh = rc.B - rc.T; if (w<=0||hh<=0) return "nosize";
    using (var bmp = new Bitmap(w, hh, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(bmp)) g.CopyFromScreen(p.X, p.Y, 0, 0, new Size(w, hh));
      var d = bmp.LockBits(new Rectangle(0,0,w,hh), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      int stride = d.Stride; byte[] buf = new byte[stride*hh]; Marshal.Copy(d.Scan0, buf, 0, buf.Length); bmp.UnlockBits(d);
      long lightSide=0, nHead=0, darkSide=0, nSide=0, colorContent=0, nContent=0, nonBlack=0, nTotal=0;
      for (int y=0;y<hh;y+=2) for (int x=0;x<w;x+=2) {
        int i=y*stride+x*4; int b=buf[i],gg=buf[i+1],r=buf[i+2];
        int max=Math.Max(r,Math.Max(gg,b)), min=Math.Min(r,Math.Min(gg,b));
        nTotal++; if (max>20) nonBlack++;
        if (x<200 && y<48) { nHead++; if (max>180) lightSide++; }
        if (x<200 && y>=48 && y<420) { nSide++; if (max<=12) darkSide++; }
        if (x>230 && y>170) { nContent++; if (max-min>60 && max>90) colorContent++; }
      }
      if (!string.IsNullOrEmpty(savePath)) bmp.Save(savePath, ImageFormat.Png);
      return string.Format("nonBlack={0:F4} sideLight={1:F4} sideDark={2:F3} contentColor={3:F4}",
        (double)nonBlack/nTotal, (double)lightSide/Math.Max(1,nHead), (double)darkSide/Math.Max(1,nSide), (double)colorContent/Math.Max(1,nContent));
    }
  }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'PsProbe').Type) { Add-Type -TypeDefinition $src -ReferencedAssemblies System.Drawing }
if ($FramesDir) { New-Item -ItemType Directory -Force -Path $FramesDir | Out-Null }
Get-Process pokestats -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 800
for ($run = 1; $run -le $Runs; $run++) {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process -FilePath $Exe -PassThru
  $shell = $null; $ui = $null; $black = 0; $firstBlack = $null
  "RUN $run pid=$($p.Id)"
  while ($sw.ElapsedMilliseconds -lt $MaxMs) {
    $p.Refresh()
    $h = $p.MainWindowHandle
    $t = $sw.ElapsedMilliseconds
    if ($h -ne 0 -and [PsProbe]::IsWindowVisible($h)) {
      $save = ""
      if ($FramesDir) { $save = Join-Path $FramesDir ("run{0}-t{1:D4}.png" -f $run, $t) }
      $m = [PsProbe]::Measure($h, $save)
      "  t=$t $m"
      $nonBlack = [double]([regex]::Match($m, 'nonBlack=([\d.]+)').Groups[1].Value)
      $sideLight = [double]([regex]::Match($m, 'sideLight=([\d.]+)').Groups[1].Value)
      $sideDark = [double]([regex]::Match($m, 'sideDark=([\d.]+)').Groups[1].Value)
      $color = [double]([regex]::Match($m, 'contentColor=([\d.]+)').Groups[1].Value)
      if ($null -eq $shell -and $sideDark -ge 0.7 -and $sideLight -gt 0.01) { $shell = $t }
      if ($null -ne $shell -and $nonBlack -lt 0.005) { $black++; if ($null -eq $firstBlack) { $firstBlack = $t } }
      if ($null -eq $ui -and $color -gt 0.004 -and $sideDark -ge 0.7) { $ui = $t }
      if ($null -ne $ui -and $t -gt $ui + 400) { break }
    }
    Start-Sleep -Milliseconds $StepMs
  }
  $fb = if ($null -eq $firstBlack) { "-" } else { $firstBlack }
  "SUMMARY run=$run shell=$shell ui=$ui blackFrames=$black firstBlackAt=$fb"
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 1500
}
```

Save the file as **UTF-8** (with or without BOM). Windows PowerShell 5 fails
to parse UTF-16 scripts without a BOM.

Run the baseline **before changing any code**, with the current release exe
(build it first with `release.ps1` if `src-tauri/target/release/pokestats.exe`
is missing). Keep the output; you will compare against it.

**Verify**: `powershell -ExecutionPolicy Bypass -File .\tools\perf\startup-probe.ps1 -Runs 3`
→ three `SUMMARY` lines. Expected baseline on the maintainer's machine:
`shell` ≈ 300–380, `ui` ≈ 500–650, `blackFrames` ≥ 1 in most runs. If
`shell` is empty in all runs, save frames (`-FramesDir $env:TEMP\ps-frames`)
and look at the PNGs: if the shell is visibly there but `sideDark` is < 0.7,
lower the threshold in the script (document the new value in the plan file)
— do not proceed with an instrument that cannot see the shell.

### Step 2: Rust — reveal on signal, not on `Finished` (Phase A)

In `src-tauri/src/lib.rs`:

1. Add statics next to `WEBVIEW_READY`:

```rust
static PAGE_FINISHED: AtomicBool = AtomicBool::new(false);
static BOOT_START: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();
```

   Set `BOOT_START.get_or_init(std::time::Instant::now)` as the first line of `run()`.

2. Add a boot log helper (release exe has no console). It appends one line to
   `%TEMP%\pokestats-boot.log` **only** when env var `POKESTATS_BOOT_LOG` is set:

```rust
fn boot_log(msg: &str) {
  if std::env::var_os("POKESTATS_BOOT_LOG").is_none() {
    return;
  }
  use std::io::Write;
  let ms = BOOT_START.get().map(|s| s.elapsed().as_millis()).unwrap_or(0);
  if let Ok(mut f) = std::fs::OpenOptions::new()
    .create(true)
    .append(true)
    .open(std::env::temp_dir().join("pokestats-boot.log"))
  {
    let _ = writeln!(f, "{ms:>6} ms  {msg}");
  }
}
```

3. Add the reveal function and the command. `reveal` is idempotent (uses
   `swap`) and does its Win32 work on the main thread:

```rust
fn reveal_webview(app: &tauri::AppHandle, reason: &'static str) {
  if WEBVIEW_READY.swap(true, Ordering::SeqCst) {
    return;
  }
  boot_log(&format!("reveal webview ({reason})"));
  let app = app.clone();
  let _ = app.run_on_main_thread(move || {
    #[cfg(target_os = "windows")]
    if let Some(win) = app.get_window("main") {
      if let Ok(hwnd) = win.hwnd() {
        winpaint::finish(hwnd.0 as isize);
      }
    }
    #[cfg(not(target_os = "windows"))]
    let _ = &app;
  });
}

#[tauri::command]
fn shell_ready(app: tauri::AppHandle) {
  reveal_webview(&app, "js");
}
```

   Register it: `.invoke_handler(tauri::generate_handler![shell_ready])` on the
   builder. (`app.get_window("main")` works for both the config
   `WebviewWindow` used in Phase A and the bare `Window` of Phase B — `Manager::get_window`
   returns the `Window` in both cases.)

4. Change `on_page_load`:
   - `Started`: if `!WEBVIEW_READY`, call `hide_child_windows(hwnd)` and
     `winpaint::request_repaint(hwnd)` (new; see step 5) instead of `paint_shell`.
   - `Finished`: `PAGE_FINISHED.store(true)`, `boot_log("page finished")`,
     and start the fallback timer: `winpaint::start_fallback_timer(hwnd)`.
     **Do not** call `show_child_windows` here anymore.
   - Get the HWND via `webview.window().hwnd()` (works in both phases) instead
     of `get_webview_window("main")`.

5. Rework `winpaint` (Windows only). Replace the 16 ms paint timer with a
   comctl32 subclass that paints on demand, a 50 ms safety timer that only
   hides stray children, and a fallback reveal timer:

```rust
#[link(name = "comctl32")]
extern "system" {
  fn SetWindowSubclass(hwnd: isize, proc_: SubclassProc, id: usize, refdata: usize) -> i32;
  fn RemoveWindowSubclass(hwnd: isize, proc_: SubclassProc, id: usize) -> i32;
  fn DefSubclassProc(hwnd: isize, msg: u32, wparam: usize, lparam: isize) -> isize;
}
type SubclassProc = unsafe extern "system" fn(isize, u32, usize, isize, usize, usize) -> isize;

// user32 additions
fn BeginPaint(hwnd: isize, ps: *mut PaintStruct) -> isize;
fn EndPaint(hwnd: isize, ps: *const PaintStruct) -> i32;
fn InvalidateRect(hwnd: isize, rc: *const Rect, erase: i32) -> i32;
fn RedrawWindow(hwnd: isize, rc: *const Rect, rgn: isize, flags: u32) -> i32;

#[repr(C)]
struct PaintStruct { hdc: isize, erase: i32, paint: Rect, restore: i32, inc_update: i32, reserved: [u8; 32] }

const WM_PAINT: u32 = 0x000F;
const WM_ERASEBKGND: u32 = 0x0014;
const WM_PARENTNOTIFY: u32 = 0x0210;
const WM_CREATE: u32 = 0x0001;
const RDW_INVALIDATE: u32 = 0x0001;
const RDW_ERASE: u32 = 0x0004;
const RDW_UPDATENOW: u32 = 0x0100;
const SUBCLASS_ID: usize = 0x504B; // "PK"
const TIMER_HIDE: usize = 1;
const TIMER_FALLBACK: usize = 2;

unsafe extern "system" fn shell_proc(hwnd: isize, msg: u32, wparam: usize, lparam: isize, _id: usize, _ref: usize) -> isize {
  if WEBVIEW_READY.load(Ordering::SeqCst) {
    return DefSubclassProc(hwnd, msg, wparam, lparam);
  }
  match msg {
    WM_ERASEBKGND => {
      paint_shell_to(hwnd, wparam as isize);
      1
    }
    WM_PAINT => {
      let mut ps: PaintStruct = std::mem::zeroed();
      let hdc = BeginPaint(hwnd, &mut ps);
      if hdc != 0 {
        paint_shell_to(hwnd, hdc);
      }
      EndPaint(hwnd, &ps);
      DefSubclassProc(hwnd, msg, wparam, lparam) // let tao emit RedrawRequested; region is already valid
    }
    WM_PARENTNOTIFY if (wparam & 0xFFFF) as u32 == WM_CREATE => {
      ShowWindow(lparam, SW_HIDE); // a child (wry's WRY_WEBVIEW host) was just created — keep it hidden
      DefSubclassProc(hwnd, msg, wparam, lparam)
    }
    _ => DefSubclassProc(hwnd, msg, wparam, lparam),
  }
}

unsafe extern "system" fn on_hide_timer(hwnd: isize, _: u32, id: usize, _: u32) {
  if WEBVIEW_READY.load(Ordering::SeqCst) { KillTimer(hwnd, id); return; }
  EnumChildWindows(hwnd, Some(each_child_hide), 0);
}

unsafe extern "system" fn on_fallback_timer(hwnd: isize, _: u32, id: usize, _: u32) {
  KillTimer(hwnd, id);
  if !WEBVIEW_READY.load(Ordering::SeqCst) {
    super::boot_log("reveal webview (fallback)");
    WEBVIEW_READY.store(true, Ordering::SeqCst);
    finish(hwnd);
  }
}

pub fn install(hwnd: isize) {
  unsafe {
    SetWindowSubclass(hwnd, shell_proc, SUBCLASS_ID, 0);
    EnumChildWindows(hwnd, Some(each_child_hide), 0);
    SetTimer(hwnd, TIMER_HIDE, 50, Some(on_hide_timer));
    RedrawWindow(hwnd, std::ptr::null(), 0, RDW_INVALIDATE | RDW_ERASE | RDW_UPDATENOW);
  }
}

pub fn request_repaint(hwnd: isize) {
  unsafe { InvalidateRect(hwnd, std::ptr::null(), 1); }
}

pub fn start_fallback_timer(hwnd: isize) {
  unsafe { SetTimer(hwnd, TIMER_FALLBACK, 2500, Some(on_fallback_timer)); }
}

pub fn finish(hwnd: isize) {
  unsafe {
    KillTimer(hwnd, TIMER_HIDE);
    KillTimer(hwnd, TIMER_FALLBACK);
    RemoveWindowSubclass(hwnd, shell_proc, SUBCLASS_ID);
    EnumChildWindows(hwnd, Some(each_child_show), 0);
    InvalidateRect(hwnd, std::ptr::null(), 1);
  }
}
```

   Rename the existing `paint_shell(hwnd)` to `paint_shell_to(hwnd, hdc)`:
   delete its `GetDC`/`ReleaseDC` lines and take `hdc` as a parameter; keep
   every drawing call unchanged. Remove `on_paint_timer`/`start_paint_timer`.
   Keep `hide_child_windows`/`show_child_windows` (used by `Started` and `finish`).

   In `setup` (Phase A keeps the config window): replace the three calls
   `hide_child_windows; paint_shell; start_paint_timer` with `winpaint::install(hwnd)`.

**Verify**: `cargo check --manifest-path src-tauri/Cargo.toml` → exit 0
(warnings about unused functions are acceptable only if you then remove the
dead functions).

### Step 3: JS — signal when the first real content is committed

Create `src/lib/boot/shellReady.ts`:

```ts
import { invoke } from "@tauri-apps/api/core"

let sent = false

/** Tell the native shell the WebView has a painted frame. Idempotent. No-op outside Tauri. */
export function signalShellReady(reason: string): void {
  if (sent) return
  sent = true
  console.log(`[perf] shell ready (${reason}) ${performance.now().toFixed(1)}ms`)
  invoke("shell_ready").catch(() => {})
}

/**
 * Wait until an element matching `selector` is in the DOM (the first route's
 * real content), give the compositor one more frame, then signal. Caps at
 * `maxFrames` frames or `maxMs` ms so a slow/failed route still reveals.
 */
export function signalWhenPainted(selector: string, maxFrames = 90, maxMs = 1500): void {
  let frames = 0
  const timeout = window.setTimeout(() => signalShellReady("timeout"), maxMs)
  const tick = () => {
    frames++
    if (document.querySelector(selector) || frames >= maxFrames) {
      requestAnimationFrame(() => {
        window.clearTimeout(timeout)
        signalShellReady(document.querySelector(selector) ? "content" : "frames")
      })
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
```

In `src/App.tsx`, inside the existing `App` effect (right after the
`[perf] first paint` log), add `signalWhenPainted("[data-boot-content]")`.
Import from `@/lib/boot/shellReady`.

In `src/routes/dex.tsx`, add `data-boot-content=""` to the virtualized
scroller `<div ref={parentRef} ...>` (line 495). It only renders once
`data` exists, so the selector matches exactly when the list is committed.

Note on dev mode (`pnpm dev` in a browser): `invoke` rejects — the `.catch`
swallows it. Nothing else changes.

**Verify**: `pnpm exec tsc -b --pretty false` → exit 0; `pnpm lint` → exit 0;
`pnpm test` → all pass.

### Step 4: Ship gate + probe for Phase A

Run `powershell -ExecutionPolicy Bypass -File .\release.ps1` → exit 0.

Then, in a shell where `POKESTATS_BOOT_LOG=1` is set for the child process
(PowerShell: `$env:POKESTATS_BOOT_LOG = "1"` before launching the probe; the
probe's `Start-Process` inherits it), run
`powershell -ExecutionPolicy Bypass -File .\tools\perf\startup-probe.ps1 -Runs 5`
and read `%TEMP%\pokestats-boot.log`.

**Verify**:
- `blackFrames=0` in **all 5 runs** (this is the whole point of Phase A).
- `%TEMP%\pokestats-boot.log` contains `reveal webview (js)` for every run and
  **no** `(fallback)` lines. If you see `(fallback)`, the page's `requestAnimationFrame`
  is not ticking while the WRY_WEBVIEW child is hidden → go to STOP conditions
  ("rAF does not tick while hidden") — the escape hatch there is prescribed.
- `ui` is not more than 10 % later than the baseline median from Step 1.
- `shell` is unchanged (~300–380) — Phase B fixes that.

Commit Phase A.

### Step 5: Rust — window first, webview second (Phase B)

1. `src-tauri/Cargo.toml`: `tauri = { version = "2.11.3", features = ["unstable"] }`.
2. `src-tauri/tauri.conf.json`: set `"app": { "windows": [], ... }` (remove the
   one window object; keep `security`). Everything the object declared moves
   into code below.
3. In `setup`, before `winpaint::install`, build the window and then the webview:

```rust
let window = tauri::window::WindowBuilder::new(app, "main")
  .title("PokeStats")
  .inner_size(1280.0, 800.0)
  .min_inner_size(1024.0, 640.0)
  .resizable(true)
  .theme(Some(tauri::Theme::Dark))
  .background_color(tauri::window::Color(0x0a, 0x0a, 0x0a, 0xff))
  .visible(true)
  .build()?;
apply_caption(&window); // change its parameter type from &tauri::WebviewWindow to &tauri::Window
#[cfg(target_os = "windows")]
if let Ok(hwnd) = window.hwnd() {
  winpaint::install(hwnd.0 as isize);
}
boot_log("window shown, shell installed");
let size = window.inner_size()?;
let _webview = window.add_child(
  tauri::webview::WebviewBuilder::new("main", tauri::WebviewUrl::default()).auto_resize(),
  tauri::LogicalPosition::new(0.0, 0.0),
  size,
)?;
boot_log("webview attached");
```

   Remove the old `if let Some(win) = app.get_webview_window("main")` block
   entirely (including `win.show()` / `win.set_focus()`; `WindowBuilder` is
   visible and focused by default). Check the exact builder method names against
   `~/.cargo/registry/src/*/tauri-2.11.5/src/window/mod.rs` if `cargo check`
   complains (`background_color` takes `tauri::window::Color`; `theme` takes
   `Option<tauri::Theme>`).

4. `on_page_load` already uses `webview.window().hwnd()` (Step 2), so nothing
   changes there. `reveal_webview` uses `app.get_window("main")` — unchanged.

**Verify**: `cargo check --manifest-path src-tauri/Cargo.toml` → exit 0.
Then `pnpm tauri dev` (or the release build) and manually confirm, in this
order: the window opens, the Dex loads, resizing the window resizes the
content, clicking the search box focuses it and typing works, Ctrl+click on a
Dex row opens a workspace tab, the title bar is dark. Any failure → STOP
condition "multiwebview regression".

### Step 6: Ship gate + probe for Phase B

Run `release.ps1` → exit 0. Run the probe with `-Runs 5` and the boot log enabled.

**Verify**:
- `shell` ≤ 120 ms in at least 4 of 5 runs (baseline ≈ 300–380).
- `blackFrames=0` in all runs.
- boot log per run, in this order: `window shown, shell installed` < 80 ms;
  `webview attached` ≈ 250–350 ms; `page finished`; `reveal webview (js)`.
- `ui` within 10 % of the Phase A median.

Commit Phase B. Update `plans/README.md`.

## Test plan

- No unit tests can cover Win32 painting; the machine-checkable gate is the
  probe (`tools/perf/startup-probe.ps1`) plus the boot log.
- `pnpm test` must stay green (no TS logic changed except the two small files).
- Manual checklist from Step 5 (resize, focus, Ctrl+click tabs, dark caption).

## Done criteria

ALL must hold:

- [ ] `tools/perf/startup-probe.ps1` exists and prints `SUMMARY` lines.
- [ ] Probe, 5 runs, release exe: `blackFrames=0` in every run.
- [ ] Probe, 5 runs: median `shell` ≤ 120 ms (Phase B) — or, if Phase B was
      STOPped and reported, Phase A alone is DONE with `shell` unchanged and
      the STOP recorded in `plans/README.md`.
- [ ] `%TEMP%\pokestats-boot.log` shows `reveal webview (js)` for each run and
      zero `(fallback)` lines.
- [ ] `rg "start_paint_timer|on_paint_timer" src-tauri/src/lib.rs` → no matches.
- [ ] `rg "show_child_windows" src-tauri/src/lib.rs` → appears only inside `winpaint::finish`'s
      call chain (i.e. not in the `Finished` arm).
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` exit 0; `pnpm exec tsc -b --pretty false` exit 0; `pnpm test` exit 0; `pnpm lint` exit 0.
- [ ] `release.ps1` exit 0 with artifact list.
- [ ] `git status` shows no modified files outside the in-scope list.
- [ ] `plans/README.md` status row for 004 updated.

## STOP conditions

Stop and report back if:

- Any "Current state" excerpt does not match the live file.
- **rAF does not tick while hidden**: Phase A's boot log shows `(fallback)` or
  the JS log says `shell ready (timeout)` in most runs. Prescribed escape
  hatch — try exactly one alternative, then report either way: instead of
  `ShowWindow(child, SW_HIDE)`, move the WRY_WEBVIEW child off the client area
  with `SetWindowPos(child, 0, -width, 0, width, height, SWP_NOZORDER | SWP_NOACTIVATE)`
  in both `each_child_hide` and the `WM_PARENTNOTIFY` arm, and put it back at
  `(0, 0)` in `finish` (read the size with `GetClientRect(parent)`). Chromium
  keeps compositing an off-screen-but-visible HWND.
- **Command not allowed**: the JS console shows an error like
  `shell_ready not allowed` — report; the fix would be a permission file under
  `src-tauri/permissions/` plus a capability entry (out of scope until confirmed).
- **Multiwebview regression** (Phase B): resize, focus, typing, Ctrl+click,
  or the dark caption break and one fix attempt does not restore them. Revert
  Phase B (keep Phase A), mark 004 as "DONE (Phase A only)" with the reason.
- `cargo check` fails on the `unstable` feature or `add_child`/`auto_resize`
  signatures and one look at the tauri source does not resolve it.
- `release.ps1` fails twice for the same reason.

## Maintenance notes

- If the app ever adds a second window or a splash, reuse `winpaint::install`
  — it is per-HWND. The reveal is global (`WEBVIEW_READY`); make it per-window
  if a second webview appears.
- If `index.html`'s skeleton or `Shell.tsx` geometry changes (sidebar width,
  header height, tab strip), update `paint_shell_to` to match, otherwise the
  handoff frame will visibly jump. The three sources of truth are: GDI shell,
  HTML skeleton, React `Shell`.
- Reviewers: check that `WM_PAINT` in `shell_proc` calls `EndPaint` on every
  path and that `finish` runs on the main thread (`run_on_main_thread`).
- `EnumChildWindows` enumerates *all descendants*, so `finish` also `SW_SHOW`s
  WebView2's internal windows. Today's `show_child_windows` already does this
  and works. If a future WebView2 runtime shows artifacts after reveal,
  restrict both hide and show to direct children (`GetWindow(hwnd, GW_CHILD)`
  then `GW_HWNDNEXT`).
- Deferred: caching the `HFONT` across paints (was the 16 ms churn concern;
  with on-demand painting there are only a handful of paints per boot).
- Deferred: React 19.2's `<Activity>` for keeping tab subtrees alive — see
  Plan 007's notes; unrelated to boot.
