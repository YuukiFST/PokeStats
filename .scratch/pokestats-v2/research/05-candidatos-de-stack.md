# 05 — Candidatos de stack para desktop Windows offline e rápido

Research output for ticket `05-candidatos-de-stack`. Facts with sources. Unverifiable claims are marked `UNCONFIRMED` with a proposed measurement.

Written in English because the caller specified the section and table format verbatim in English; repo convention (`map.md`) is pt-BR for tickets, so translate before pasting into `issues/05`.

---

## 0. Corrections to the premise, and the measured baseline

Two inputs to this research were assumptions. Both were measured.

### 0.1 The asset payload is not ~400 MB. It is 155 MB, or 308 MB with shinies.

Ticket 02 (`issues/02-fontes-sprites.md`, status resolved) measured the real directory listings rather than estimating:

| Set | Files | Total | Animated |
|---|---|---|---|
| `ani/` (front only) | 1,686 | **154.63 MB** | yes, GIF |
| `ani/` + `ani-shiny/` | 3,329 | **307.94 MB** | yes |
| official artwork 475x475 | 1,339 | 162.44 MB | no |

Ticket 02 also measured that compression is pointless: 10 real GIFs totalling 748,383 bytes reached only 97.8% of original with `gzip -9` and 97.9% with `xz -9`, because GIF LZW is already compressed.

**Consequences that run through every section below.** The realistic payload is **155–310 MB**, not 400 MB. Every compression-based mechanism (Tauri Brotli, .NET `EnableCompressionInSingleFile`, Electron asar, PyInstaller CArchive zlib) buys ~2% size and costs CPU. Turn compression off everywhere. 400 MB stays the ceiling for the sizing table below, per the ticket's brief.

### 0.2 Measured inventory of the target machine (2026-08-21)

Read directly off this box, not assumed:

| Fact | Value | How verified |
|---|---|---|
| OS | Windows 11 Pro, build 10.0.22631 | `Get-CimInstance Win32_OperatingSystem` |
| CPU | Intel Core i3-9100F @ 3.60 GHz (4C/4T, no iGPU) | `Get-CimInstance Win32_Processor` |
| RAM | 15.9 GB | `Win32_ComputerSystem.TotalPhysicalMemory` |
| Disk | ADATA SU630, SATA SSD (QLC) | `Get-PhysicalDisk` |
| Node | v22.18.0 | `node --version` |
| Python | 3.13.6 | `python --version` |
| **WebView2 Runtime** | **151.0.4129.93, per-machine** | `HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}\pv` — the exact key Microsoft documents for detection ([distribution docs](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)) |
| `vcruntime140.dll` | 14.44.35211.0, present in `System32` | `Get-Item` |
| .NET | **not installed** (no `dotnet.exe` in either Program Files) | filesystem probe |
| Rust / Flutter / MSVC / MSBuild | **none on PATH** | `Get-Command` |
| Defender real-time protection | **disabled** | `Get-MpComputerStatus` |

Two things follow. The i3-9100F has **no integrated GPU** — it is a CPU-only F-series part, so any GPU-accelerated renderer depends on whatever discrete card is fitted; verify before betting on Impeller/Skia/DirectX paths. And Defender RTP being off means every timing measured on this box is a **floor**, not a typical figure: the other ~3 users will have RTP on.

### 0.3 First-party measurement: what temp extraction actually costs here

This is the number that decides several stacks, and no published figure exists for it, so I measured it.

Wrote 1,686 files of 96,000 bytes each (matching the real sprite count and mean size) to `%TEMP%`:

```
WRITE 1686 files / 154.4 MB to TEMP : 2,801 ms
DELETE same tree                    :   392 ms
```

Machine: i3-9100F, ADATA SU630 SATA SSD, Defender RTP **off**.

**2.8 seconds of pure I/O before a single line of application code runs**, for the front-sprites-only payload. With shinies (308 MB) it roughly doubles to ~5.6 s. With Defender RTP on — the default state on the other machines — 1,686 freshly written files in `%TEMP%` get scanned, which can only make it worse.

Any stack that materialises its payload to disk at launch has already blown R5 ("abertura rápida", "abas em menos de 1s") on the extraction alone.

### 0.4 The cross-cutting mechanism: PE demand paging vs. temp extraction

This is the single fact that separates the viable stacks from the rest.

Microsoft, on embedding a large binary as a resource in a Win32 PE:

> "embedding a large binary as RCDATA in `.rsrc` increases the executable's `SizeOfImage`, even if you access it 'on demand'. […] The Win32 resource APIs operate on data **already mapped by the loader**. 'Loaded on demand' refers only to **physical memory paging**, which means pages are faulted in when accessed, but the virtual address space is reserved at load time."
> — [Microsoft Q&A, accepted answer](https://learn.microsoft.com/en-us/answers/questions/5675965/does-embedding-a-large-binary-as-rcdata-in-a-win32)

On x64, reserving 310 MB of virtual address space costs nothing. Physical pages fault in only when a sprite is actually requested. So **a 64-bit exe with the sprites in a read-only data section pays ~0 ms at process start** and pays one page fault per sprite actually displayed.

That is the opposite of self-extracting archives, which must write the whole payload to disk before `main()` runs. The 2,801 ms above is the price of getting that wrong.

Stacks that get demand paging: Tauri (`include_dir!` / `EmbeddedAssets` land in `.rdata` of the exe), .NET single-file with `EmbeddedResource` (see §3.1 for the caveat).
Stacks that pay extraction: Electron `portable`, PyInstaller `--onefile`, WinUI 3 single-file, .NET single-file with `IncludeAllContentForSelfExtract`.

---

## 1. Tauri v2 (Rust + system WebView2)

Current stable: **2.10.1, released 2026-03-04** ([Wikipedia](https://en.wikipedia.org/wiki/Tauri_(software_framework))); `tauri` crate at 2.11.5, 2026-07-01 ([docs.rs](https://docs.rs/tauri/latest/tauri/struct.Builder.html)).

### 1. Single-file binary size

Official floor claim: "the size of a Tauri app can be little as 600KB" ([v2.tauri.app](https://v2.tauri.app/)).

Measured on a non-trivial app: **8.6 MiB** for a multi-window demo, vs Electron's 244 MiB, macOS, single run N=1 ([gethopp.app benchmark](https://www.gethopp.app/blog/tauri-vs-electron) — the author states the sample size explicitly).

Real migration: Hoppscotch Desktop went Electron to Tauri, "bundle size reduction from 165 MB to 8 MB" ([dev.to/hoppscotch](https://dev.to/hoppscotch/hoppscotch-desktop-for-mac-a-fast-lightweight-alternative-to-postman-4mbm)).

**Projected here: ~8 MB shell + 155 MB sprites + dataset ≈ 165–175 MB.** `UNCONFIRMED` at this exact payload. Measure: build twice (Brotli on/off), `(Get-Item src-tauri\target\release\pokestats.exe).Length`.

### 2. Cold start

**`UNCONFIRMED`. No credible published Windows cold-start benchmark for Tauri v2 exists.**

The one benchmark with a stated method measured macOS only and found the Tauri/Electron difference "negligible", advising against deciding on startup deltas under 1,500 ms ([gethopp.app](https://www.gethopp.app/blog/tauri-vs-electron)). Every "Tauri starts 4x faster" figure traces back to unsourced SEO aggregation — treat as marketing.

One historical WebView2-side regression on record: "a basic tauri application needed 5~ seconds to load a page" on WebView2 90.0.818.62 ([wry#275](https://github.com/tauri-apps/wry/issues/275)), closed as `status: waiting` with no documented fix.

**How to measure — and a warning from trying it.** I attempted the obvious external harness (`Start-Process` then poll `Process.MainWindowHandle`) on this machine against `notepad.exe` and it returned 1,182–2,475 ms with `gotWindow=0` every time: Windows 11's Notepad is a packaged app whose window belongs to a different process, so `MainWindowHandle` never becomes non-zero. **Do not build the cold-start harness on `MainWindowHandle`** — it will silently lie for any multi-process app, which includes every webview stack (the WebView2/Chromium renderer is a child process).

Use instead: instrument the app itself. Capture `std::time::Instant` at `main()` entry, emit a timestamp from JS on `requestAnimationFrame` after first meaningful paint, log the delta. Compare against `Process.StartTime` from outside. Run 10 cold (reboot between) and 10 warm, report medians, and run each set with Defender RTP on and off.

### 3. Truly runtime-free?

**WebView2 is guaranteed on Windows 11, from Microsoft's own docs:**

> "The Evergreen Runtime is preinstalled onto all Windows 11 devices as a part of the Windows 11 operating system."
> — [evergreen-vs-fixed-version](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version)

> "The Evergreen WebView2 Runtime will be included as part of the Windows 11 operating system."
> — [distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)

Tauri's docs concur: "On Windows 10 (April 2018 release or later) and Windows 11, the WebView2 runtime is distributed as part of the operating system" ([windows-installer](https://v2.tauri.app/distribute/windows-installer/)).

**Verified present on this exact machine** (§0.2): version 151.0.4129.93, per-machine.

Microsoft still hedges: "we recommend that you distribute the WebView2 Runtime, to cover edge cases where the Runtime wasn't already installed" and "Before your app creates a WebView2, the app should check whether the WebView2 Runtime is present" (same URLs).

**What happens if it is absent.** The app dies silently. Reported case: "the window appeared and then immediately closed" after the user uninstalled Edge and the WebView2 Runtime; reinstalling fixed it ([tauri#12030](https://github.com/tauri-apps/tauri/issues/12030)).

**The `webviewInstallMode` table** ([official](https://v2.tauri.app/distribute/windows-installer/)):

| Mode | Internet required | Size added |
|---|---|---|
| `downloadBootstrapper` (default) | yes | 0 MB |
| `embedBootstrapper` | yes | ~1.8 MB |
| `offlineInstaller` | **no** | **~127 MB** |
| `fixedVersion` | **no** | **~180 MB** |
| `skip` | no | 0 MB — "Your application WILL NOT work if the user does not have the runtime installed." |

Note the brief's figure of ~150 MB for `offlineInstaller` is off: the doc says **~127 MB**. Microsoft separately states Fixed Version binaries "are over 250 MB" ([distribution](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)).

**Critical: `offlineInstaller` and `fixedVersion` are installer/bundle options. They do not exist for a bare portable exe.** R3 forbids an installer, so the offline-repair path is unavailable by construction. On Win11-only that is acceptable; the residual risk is a machine where WebView2 was deliberately removed, which you can detect (registry key above) and message about, but not repair.

**Does `tauri build` emit a runnable portable exe?** Yes, but unofficially. Maintainer FabianLars: the `.exe` in `target/release/` (not `bundle/`) works standalone, but **you lose deep links, file associations, sidecar, `resources`, and updater**, and "new features in the future may also require bundles/installers" ([discussion #11167](https://github.com/orgs/tauri-apps/discussions/11167), also [#3048](https://github.com/tauri-apps/tauri/discussions/3048)). There is **no documented `portable` bundle target** — official outputs are `bundle/msi/` and `bundle/nsis/`.

**VC++ redistributable:** the portable exe normally needs `vcruntime140.dll`. It is present on this machine (§0.2), but that is not guaranteed elsewhere. Remove the dependency entirely with `.cargo/config.toml`:

```toml
[target.'cfg(all(windows, target_env = "msvc"))']
rustflags = ["-C", "target-feature=+crt-static"]
```

which "will cause a statically linked copy of the CRT to be included" ([Rust RFC 1721](https://github.com/Rust-lang/rfcs/blob/master/text/1721-crt-static.md), [users.rust-lang.org](https://users.rust-lang.org/t/windows-binaries-vcruntime140-dll-not-found-unless-crt-static/94517)); or via the [`static_vcruntime`](https://github.com/chrisdenton/static_vcruntime) crate. The UCRT is an OS component and can stay dynamic.

**Net: on Win11, `target/release/pokestats.exe` with `+crt-static` is a genuine single portable exe with no runtime prerequisite.**

### 4. Embedding the assets

Frontend assets in `build.frontendDist` "are embedded in the application binary" ([config reference](https://v2.tauri.app/reference/config/)). `tauri-codegen` reads them, **Brotli-compresses (the `compression` feature, on by default)**, SHA-256 hashes them, and emits a `HashMap<String, EmbeddedAsset>` ([DeepWiki: code generation](https://deepwiki.com/tauri-apps/tauri/7.5-code-generation-and-build-scripts)). Runtime access is `AssetResolver::get()` ([docs.rs](https://docs.rs/tauri/latest/tauri/struct.AssetResolver.html)).

**Turn Brotli off.** Ticket 02 measured that GIFs compress ~2%, and the decompression is per-request: open request "Allow uncompressed resources embedded to the executable binary" — "in production tauri app will compress it into its binary target. Using it will lead some time cost to uncompressed the data" ([tauri#8894](https://github.com/tauri-apps/tauri/issues/8894), still open, no maintainer response). Tauri also warns Brotli "embeds a large (~170KiB) lookup table […] if the resources you embed are smaller than this or compress poorly, the resulting binary may be bigger than any savings" ([app-size guide](https://v1.tauri.app/v1/guides/building/app-size/)). Disable via `tauri = { default-features = false, features = [...] }`.

**The better architecture** is not `frontendDist` at all: put the sprites in a separate crate with [`include_dir`](https://docs.rs/include_dir/latest/include_dir/) (MIT, 0.7.4) and serve them from a custom protocol. `Builder::register_uri_scheme_protocol` returns `Response<T> where T: Into<Cow<'static, [u8]>>` ([docs.rs](https://docs.rs/tauri/latest/tauri/struct.Builder.html)), so a `&'static [u8]` from `include_dir!` is returned **borrowed — zero copy on the Rust side, straight out of a demand-paged `.rdata` section** (§0.4). `register_asynchronous_uri_scheme_protocol` exists to keep the main thread free.

**Build-time cost, with real numbers.** `include_dir`'s own benchmark: 620 files / 64 MB raised compile time from 1.5 s to 5 s, compiler RAM from 200 MB to 730 MB, binary from 7 MB to 72 MB ([docs.rs](https://docs.rs/include_dir/latest/include_dir/)). Linear extrapolation to 1,686 files / 155 MB suggests roughly +10 s and ~1.5 GB compiler RAM — fine on a 16 GB box, and mitigated by putting the assets in their own crate so they are not rebuilt.

**The one hard risk: an open build-failure bug at large asset volumes.** "[bug] Build fails if front-end files are collectively too large": ~1.8 GB of frontend assets produces `error[E0786]: found invalid metadata files for crate` / "corrupt metadata encountered". Windows 10, Tauri 2.2.2, rustc 1.84.0. **Still open, no maintainer comment, no confirmed workaround** ([tauri#12403](https://github.com/tauri-apps/tauri/issues/12403)). Our 155–310 MB is well under the reported threshold but in an untested zone. **Verify empirically before committing** — this is the cheapest de-risking experiment in this document.

`bundle.resources` (files copied next to the exe) is one of the features lost in the portable path, so it is not an escape hatch.

### 5. Toolchain to install

From the [official prerequisites](https://v2.tauri.app/start/prerequisites/):

- **Microsoft C++ Build Tools**, with the **"Desktop development with C++"** workload.
- **Rust**, with an MSVC host triple (`x86_64-pc-windows-msvc`).
- WebView2 — already present (§0.2).
- VBScript only if building MSI — not needed.

**Neither Rust nor MSVC Build Tools is on this machine.** The MSVC "Desktop development with C++" workload is a multi-GB install and is the single largest adoption cost for this stack. Note it is *not* the .NET SDK.

### 6. Geist fidelity

WebView2 "contains modified Microsoft Edge binaries" and tracks the Edge Stable cadence ([evergreen-vs-fixed-version](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version)). So Tailwind + shadcn/ui render at Chrome parity, and the entire Geist token set — oklch colours, `border-width: 1px`, focus rings, hover transitions, `font-variation-settings` — is expressible directly. **Nothing about Geist is unreachable here.**

Geist Sans/Mono are **SIL OFL 1.1** ([LICENSE](https://github.com/vercel/geist-font/blob/main/LICENSE.txt), [vercel.com/font](https://vercel.com/font)), so self-hosting the `.woff2` from embedded assets is licensed and works, **including the variable axes** — which every non-web stack in this document loses.

One caveat: the runtime is evergreen and version-variable per machine; you cannot pin it from a single exe. Tauri keeps a per-platform [webview version reference](https://v2.tauri.app/reference/webview-versions/). Microsoft's own advice is feature detection.

### 7. Animated GIF

Native. Chromium renders animated GIFs, so WebView2 does. Ticket 02 already confirmed this independently.

Caveats at 1,400-sprite scale: Chromium has had animation-consistency bugs ([crbug 40317410](https://issues.chromium.org/issues/40317410)) and many concurrent animated GIFs are a known CPU sink ([pixijs#6633](https://github.com/pixijs/pixijs/issues/6633)). **Quantitative CPU/memory figures for N concurrent GIFs: `UNCONFIRMED`** — the "15-20% CPU" numbers circulating on blogs have no traceable primary source. Measure with a WebView2 DevTools performance profile at 20/50/100 simultaneously visible sprites.

### 8. Virtualized data grid

| Library | License | Status |
|---|---|---|
| **TanStack Virtual** v3 | **MIT** ([GitHub](https://github.com/TanStack/virtual)), 7.1k stars, 692 commits | active; supports two-axis grid virtualization ([docs](https://tanstack.com/virtual/latest)) |
| **TanStack Table** | **MIT** ([LICENSE](https://github.com/TanStack/table/blob/main/LICENSE)) | headless; the canonical pairing for tens of thousands of cells |
| **AG Grid Community** | **MIT** ([licensing](https://www.ag-grid.com/react-data-grid/licensing/)) | **row and column virtualization enabled by default** ([DOM virtualisation](https://www.ag-grid.com/javascript-data-grid/dom-virtualisation/)) |
| **react-window** | MIT | ~6.6M weekly downloads ([npm](https://www.npmjs.com/package/react-window)) |

This is the strongest grid story of any stack evaluated, by a wide margin, and it is free.

### 9. Deal-breakers and production users

Deal-breakers for this app:

1. Rust + MSVC Build Tools must be installed on a machine that has neither (§5). This is a real cost, not a technical blocker.
2. The single-exe path forfeits `resources`, updater, sidecar, file associations ([#11167](https://github.com/orgs/tauri-apps/discussions/11167)) — none of which R3/R2 permit anyway.
3. Open build-failure bug at large embedded-asset volumes ([#12403](https://github.com/tauri-apps/tauri/issues/12403)). Untested at 155–310 MB.
4. No offline WebView2 repair possible from a single exe (§3).

Production users: **Hoppscotch Desktop** ([source](https://dev.to/hoppscotch/hoppscotch-desktop-for-mac-a-fast-lightweight-alternative-to-postman-4mbm)); Spacedrive, AppFlowy, Clash Verge and Padloc are commonly cited but only from secondary sources. Tauri removed its own showcase page in favour of [awesome-tauri](https://github.com/tauri-apps/awesome-tauri) ([#3969](https://github.com/orgs/tauri-apps/discussions/3969)); the "Supported by" block on v2.tauri.app is sponsors, not users. **`UNCONFIRMED`: any Fortune-500-scale Tauri v2 desktop deployment.**

---

## 2. Electron

### 1. Single-file binary size

Electron's official output is a **folder**, not an exe: the distribution guide describes shipping "a folder containing Electron's prebuilt binaries" ([application-distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution)). `@electron/packager` emits `<app>-win32-x64/` ([repo](https://github.com/electron/packager)).

Measured: **244 MiB** for a minimal multi-window demo (macOS, N=1) ([gethopp.app](https://www.gethopp.app/blog/tauri-vs-electron)). Windows datapoints from electron-builder issues run ~65 MB NSIS installer / ~230 MB installed directory ([#8399 thread](https://github.com/electron-userland/electron-builder/issues/8399)).

**Projected here: ~200–250 MB runtime + 155 MB assets ≈ 400 MB portable exe.** `UNCONFIRMED`.

### 2. Cold start — the decisive number

**Reported: ~10 s for a hello-world portable build.**

> "Startup time on my i5 8gb Windows 10 laptop is ~10 seconds for a portable built of a hello-world electron-app."
> — [electron-builder#5765](https://github.com/electron-userland/electron-builder/issues/5765), Electron 12.0.1 + electron-builder 22.10.5, closed with no maintainer fix

That is with **no payload at all**. Related complaints: [#3972](https://github.com/electron-userland/electron-builder/issues/3972), [#2548](https://github.com/electron-userland/electron-builder/issues/2548).

Real optimisation case for reference: Inkdrop cut TTI 4 s to 3 s via V8 snapshots ([devas.life](https://www.devas.life/how-to-make-your-electron-app-launch-1000ms-faster/)) — macOS, non-portable.

### 3. Truly runtime-free?

**Yes, and this is Electron's one unambiguous win: no WebView2, no OS dependency, Chromium and Node are inside the payload.** The Chromium version is pinned by you, which is strictly more deterministic than Tauri's evergreen runtime.

But a single exe only comes from **electron-builder's `portable` target** ("set target to `portable`", [nsis docs](https://www.electron.build/docs/nsis/)), and that target **extracts to `%TEMP%` at launch**. Confirmed in the source:

> `unpackDirName` — "The unpack directory for the portable app resources. If set to a string, it will be the name in TEMP directory. If set explicitly to `false`, it will use the Windows temp directory ($PLUGINSDIR) that is unique to each launch of the portable application. Defaults to uuid of build (changed on each build of portable executable)."
> `splashImage` — "The image to show **while the portable executable is extracting**."
> — [`nsisOptions.ts` lines 254-281](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/targets/win/nsis/nsisOptions.ts)

The existence of `splashImage` is itself the admission: there is a visible extraction phase long enough to need a progress image.

Because `process.execPath` then points into the temp dir, the target exposes `PORTABLE_EXECUTABLE_FILE`, `PORTABLE_EXECUTABLE_DIR`, `PORTABLE_EXECUTABLE_APP_FILENAME` ([nsis docs](https://www.electron.build/docs/nsis/), [#3841](https://github.com/electron-userland/electron-builder/issues/3841)).

**Hard size ceiling with a silent failure mode.** Standard NSIS caps at 2 GB: a ~4 GB `win-unpacked` "silently produced a 300 MB installer containing only the uninstaller", no error emitted; workaround is a custom NSISBI binary; **closed but never fixed upstream** ([#8399](https://github.com/electron-userland/electron-builder/issues/8399), [#2086](https://github.com/electron-userland/electron-builder/issues/2086)). ~400 MB is safely under, but because the failure is silent, verify the output actually runs.

### 4. Embedding the assets

asar "concatenates all files together **without compression** (like tar)" ([electron/asar](https://github.com/electron/asar)). No archive-level size limit is documented; per-file `size` is a JS Number up to `Number.MAX_SAFE_INTEGER` (~8 PB). Compressed asar is still only a feature request ([electron#29556](https://github.com/electron/electron/issues/29556)).

**asar itself is nearly free.** The one real latency source is documented:

> "Most `fs` APIs can read a file or get a file's information from ASAR archives without unpacking, but for some APIs that rely on passing the real file path to underlying system calls, Electron will extract the needed file into a temporary file… This adds a little overhead."
> Affected: `child_process.execFile(Sync)`, `fs.open(Sync)`, `process.dlopen`.
> — [asar-archives](https://www.electronjs.org/docs/latest/tutorial/asar-archives)

So serve sprites via `fs.readFile` / `createReadStream` or a `protocol.handle()` custom scheme, and **never `fs.open` an asar path in the hot loop** — that is the one API that triggers per-file temp extraction.

**The problem is not asar. It is the portable wrapper**, which materialises the entire ~400 MB payload on disk before `main.js` runs. §0.3 measured 2,801 ms for the write alone, on an SSD, with AV off — and that excludes LZMA decompression, which is CPU-bound and slower still.

### 5. Toolchain to install

**Node.js only — already present at 22.18.0.** `npm i -D electron electron-builder`. No Rust, no MSVC, no .NET. A pure-JS app with TanStack + Tailwind needs no native modules. (Electron Forge is the docs-recommended path, [forge-overview](https://www.electronjs.org/docs/latest/tutorial/forge-overview), but electron-builder is required specifically for the `portable` target.)

**This is by far the lowest toolchain cost of any candidate — zero new installs.**

### 6. Geist fidelity

Perfect, and marginally better than Tauri: Electron bundles a **pinned** Chromium, so rendering is byte-identical across machines with no evergreen drift. shadcn/ui + Tailwind + self-hosted Geist woff2 from `app.asar` behave exactly as in Chrome, variable axes included. Geist is SIL OFL 1.1 ([LICENSE](https://github.com/vercel/geist-font/blob/main/LICENSE.txt)).

### 7. Animated GIF

Native, same Chromium engine, same caveats as Tauri §7 — with the advantage that the Chromium version is pinned, so GIF behaviour is reproducible.

### 8. Virtualized data grid

Identical to Tauri §8 — same React, same libraries, same MIT licences. No stack-specific difference.

### 9. Deal-breakers and production users

1. **Bulk temp extraction of ~400 MB on launch** (§3) — directly against R5. ~10 s reported for hello-world; scales with payload.
2. 2 GB NSIS ceiling with a **silent** corruption failure mode ([#8399](https://github.com/electron-userland/electron-builder/issues/8399)).
3. Temp-directory litter; `%TEMP%` writes may be blocked or slow on locked-down machines.
4. Memory: ~409 MB for a 6-window demo vs Tauri's ~172 MB ([gethopp.app](https://www.gethopp.app/blog/tauri-vs-electron)).

**The one open question that could rescue Electron:** `unpackDirName` defaults to a **build UUID**, stable for a given exe, so the extracted directory should persist across launches of the same build — community reports say the second run "takes almost no time". But contradicting field reports of re-extraction to a new folder every run exist ([#8739](https://github.com/electron-userland/electron-builder/issues/8739)). **`UNCONFIRMED`, and it is the single most decision-relevant number for Electron.** Measure by diffing `Get-ChildItem $env:TEMP` across launches with `unpackDirName` default, set to `"pokestats"`, and set to `false`.

Production users (official showcase, 500+ apps): **VS Code, Slack, Discord, Figma, Notion, Obsidian, Postman**, GitHub Desktop, Insomnia, Twitch ([electronjs.org/apps](https://www.electronjs.org/apps)). No stack here is close on production track record.

---

## 3. .NET 8/9 WPF (self-contained single-file)

### 1. Single-file binary size, trimming, NativeAOT

**Trimming: NOT SUPPORTED. Hard-blocked by the SDK, as an error.**

> "It's not possible for trimming analysis to preserve all necessary code for WPF applications. Unfortunately, almost no WPF apps are runnable after trimming, so **trimming support for WPF is currently disabled in the .NET SDK**."
> — [trimming/incompatibilities](https://learn.microsoft.com/en-us/dotnet/core/deploying/trimming/incompatibilities)

The SDK raises `NETSDK1168: WPF is not supported or recommended with trimming enabled` from `Microsoft.NET.RuntimeIdentifierInference.targets` ([source](https://github.com/dotnet/sdk/blob/main/src/Tasks/Microsoft.NET.Build.Tasks/targets/Microsoft.NET.RuntimeIdentifierInference.targets), [Strings.resx](https://github.com/dotnet/sdk/blob/main/src/Tasks/Common/Resources/Strings.resx)). Tracking issue [dotnet/wpf#3811](https://github.com/dotnet/wpf/issues/3811) is **still open**, filed 2020-11-13, last updated 2025-11-05.

**NativeAOT: unreachable.** Native AOT "Requires trimming" ([native-aot overview](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/)); trimming is disabled for WPF. Request [dotnet/wpf#11205](https://github.com/dotnet/wpf/issues/11205) closed as duplicate.

**And `PublishReadyToRun` — the usual startup lever — is currently broken for WPF:** "WPF Button rendering broken and crash with PublishTrimmed or PublishReadyToRun in .NET 8", **open**, filed 2026-02-09 ([dotnet/wpf#11436](https://github.com/dotnet/wpf/issues/11436)).

Measured sizes: **~150 MB** single exe for a self-contained single-file WPF app, 43 MB zipped ([dotnet/wpf#3070](https://github.com/dotnet/wpf/issues/3070), open, milestone "Future"). Comparable WinForms measurement on the same bundler: ~146 MB with `IncludeAllContentForSelfExtract`, ~83 MB trimmed (unavailable to WPF), ~138 MB with R2R ([nicksnettravels](https://nicksnettravels.builttoroam.com/single-file-apps/)).

**Floor here: ~150 MB framework + 155 MB assets ≈ 305 MB, immovable.**

### 2. Cold start and the extraction question

**Precisely when .NET single-file extracts to disk** ([single-file/overview](https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview)):

> "Only managed DLLs are bundled with the app into a single executable. When the app starts, the managed DLLs are **extracted and loaded in memory, avoiding the extraction to a folder**. With this approach, the managed binaries are embedded in the single file bundle, but **the native binaries of the core runtime itself are separate files**."

> `IncludeNativeLibrariesForSelfExtract` — "embed those files for extraction and get one output file".
> `IncludeAllContentForSelfExtract` — "**extracts all files, including the managed assemblies, before running the executable**… This mode is **not recommended**: it's a .NET Core 3.1 compatibility mode and might be removed in a future release."
> "If extraction is used, the files are extracted to disk before the app starts […] If running on Windows, the files are extracted to a directory under **`%TEMP%/.net`**."

So a self-contained WPF app is **not one file by default** — the native runtime DLLs (`coreclr.dll`, `clrjit.dll`, and WPF's `PresentationNative_*.dll`, `wpfgfx_*.dll`, `D3DCompiler_47_cor3.dll`) sit loose beside the exe. To get one file you must set `IncludeNativeLibrariesForSelfExtract=true`, which writes **that small native set** to `%TEMP%\.net` on launch.

**The important consequence: that is a small extraction, not a 155 MB one.** Keep the sprites as `EmbeddedResource` inside a managed DLL and **do not** use `IncludeAllContentForSelfExtract`, and the 155 MB is never written to disk — see §3.4.

**Measured cold start:** self-contained WPF, .NET 6, ReadyToRun, x64, HP OMEN 15 / Ryzen 7 5800H / 16 GB / Win10 Pro: **cold start 2–3 s**, warm 250–300 ms; framework-dependent cold start ~500 ms. The reporter attributes the gap to Windows Defender scanning assemblies loaded serially on the main thread. **Closed as not planned** ([dotnet/runtime#78379](https://github.com/dotnet/runtime/issues/78379)).

That 2–3 s figure is on a Ryzen 7 5800H, a considerably faster part than this i3-9100F, and R2R is currently broken for WPF (#11436). **`UNCONFIRMED` for a 305 MB WPF single-file exe on this hardware.** Measure: reboot, launch, timestamp `Process.GetCurrentProcess().StartTime` to first `ContentRendered`; repeat with a Defender exclusion to isolate AV cost.

`EnableCompressionInSingleFile` is not a way out: "Compression comes with a performance cost. On application start, the assemblies must be decompressed into memory" (same overview doc), and ticket 02 already showed GIFs do not compress.

### 3. Truly runtime-free?

**Yes — the cleanest genuine one-file story among the .NET options.** Self-contained bundles the runtime ([deploying overview](https://learn.microsoft.com/en-us/dotnet/core/deploying/#publish-as-self-contained)); `*.runtimeconfig.json` and `*.deps.json` go inside the file. WPF's native dependencies ship inside the self-contained `Microsoft.WindowsDesktop.App` payload — no VC++ redistributable, no OS component beyond Windows itself.

Single-file API caveats: `Assembly.Location` returns an empty string, `Assembly.GetFile`/`GetFiles` throw `IOException`, `Assembly.CodeBase` throws. Use `AppContext.BaseDirectory` / `Environment.ProcessPath` (same doc).

### 4. Embedding the assets

Microsoft explicitly recommends this route for single-file: "To avoid shipping loose files entirely, consider using **embedded resources**" ([single-file/overview](https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview)).

**And it is mapped, not copied.** `GetManifestResourceStream` returns an `UnmanagedMemoryStream` **pointing into the assembly itself** — documented in the runtime bug that exists precisely because that stream aliases the mapped PE image ([dotnet/runtime#52061](https://github.com/dotnet/runtime/issues/52061), open; see also [#26101](https://github.com/dotnet/runtime/issues/26101)). **Startup RAM cost of a 155 MB resource is therefore ~0; pages fault in on demand** (§0.4).

Three conditions on that:

- **Do not use `.resx` / `ResourceManager`** for the sprites — that path deserialises into managed objects. Use raw `EmbeddedResource` + `GetManifestResourceStream`, and never `.ToArray()` the stream (the CLR has a 2 GB max single-object size).
- **Compression must be off** — `EnableCompressionInSingleFile=true` decompresses into memory at start, defeating demand paging.
- **Watch the R2R interaction.** The single-file design doc: on Windows, "ReadyToRun assemblies are loaded by memory mapping the file and **copying sections to appropriate offsets**" because `CreateFileMapping` lacks offset support, whereas "IL assemblies are loaded directly from the bundle" ([design.md](https://github.com/dotnet/designs/blob/main/accepted/2020/single-file/design.md)). Put the sprites in a **separate, IL-only resource assembly with R2R disabled** so it is mapped rather than copied. (Moot today anyway, since R2R is broken for WPF.)

**Documented size limit: `UNCONFIRMED`.** No published cap on `EmbeddedResource` size. Compiler-side OOM on multi-hundred-MB resources is anecdotal only. Measure: build a throwaway classlib with the 1,686 real GIFs as `EmbeddedResource` and watch `VBCSCompiler.exe` peak RSS. If csc OOMs, fall back to one concatenated `.pak` blob + an offset index — a single resource.

### 5. Toolchain to install

**.NET SDK only.** `dotnet new wpf` / `dotnet publish` work without Visual Studio. Latest SDK **9.0.317, 2026-08-11** ([download](https://dotnet.microsoft.com/en-us/download/dotnet/9.0)). Installer size ~213 MB per a secondary source ([filehorse](https://www.filehorse.com/download-dotnet-sdk/)) — `UNCONFIRMED`, the official page prints no size.

**No MSVC, no C++ workload, no Windows SDK** — the NativeAOT prerequisite is moot because WPF cannot AOT. This is the lightest new-toolchain cost of any non-webview candidate.

### 6. Geist fidelity

**Font embedding: supported.** WPF has a documented font-packaging story via pack URI `"/Assembly;component/Fonts/#Geist"` ([packaging-fonts](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/packaging-fonts-with-applications)). Geist ships static `otf`/`ttf` alongside `variable` and `webfonts` ([repo tree](https://github.com/vercel/geist-font/tree/main/fonts)), SIL OFL 1.1.

**What cannot be reproduced:**

1. **Variable font axes.** WPF does not expose OpenType variable fonts; DirectWrite does, WPF's XAML layer does not ([dotnet/wpf#7813 "Missing DirectWrite features"](https://github.com/dotnet/wpf/issues/7813), [DirectWrite variable fonts](https://learn.microsoft.com/en-us/windows/win32/directwrite/opentype-variable-fonts)). Ship discrete static weights; no `font-variation-settings` equivalent.
2. **Web-identical text rasterisation.** WPF defaults to `TextFormattingMode=Ideal` (metric-accurate, blurry at small sizes) vs `Display` (pixel-snapped) ([MSDN archive](https://learn.microsoft.com/en-us/archive/blogs/llobo/new-wpf-features-textformattingmode-for-clear-text)). Geist on the web is grayscale-antialiased by the browser; WPF ClearType subpixel output will not match at 13–14 px UI sizes. Unfixable, only tunable.
3. **1px hairlines at 125%/150%.** WPF is DIP-based: "this dpi independence can create irregular edge rendering due to anti-aliasing… blurry, or semi-transparent, edges" ([WPF graphics rendering](https://learn.microsoft.com/en-us/previous-versions/dotnet/netframework-3.5/aa970908(v=vs.90))). Both mitigations are **off by default**: `UseLayoutRounding` — "The default is `false`" ([docs](https://learn.microsoft.com/en-us/dotnet/api/system.windows.frameworkelement.uselayoutrounding)) — and `SnapsToDevicePixels` — "The default as declared on UIElement is `false`" ([docs](https://learn.microsoft.com/en-us/dotnet/api/system.windows.uielement.snapstodevicepixels)). Even with rounding on, `BorderThickness="1"` resolves to 1.25 px at 125% and 1.5 px at 150%, rounding to **1 or 2 physical px depending on position** — hairlines crisp but inconsistent in weight across the dex table unless you bind thickness to `1/DpiScale` per monitor. Layout rounding also gives star-sized `Grid` columns deliberately unequal integer widths ("2 columns that have a width of 33 and one that has a width of 34"), which matters for a dense table.
4. **No Geist or shadcn component library for XAML exists.** Searched across GitHub/NuGet/web; nothing found.

Real WPF UI kits (verified via GitHub API, 2026-08-21) — all MIT, all a *different* opinionated design system you would fight rather than extend:

| Kit | Stars | Last push | Language |
|---|---|---|---|
| WPF-UI (lepoco/wpfui) | 9,608 | 2026-06-27 | Fluent/Win11 |
| MahApps.Metro | 9,815 | 2026-08-20 | Metro |
| HandyControl | 7,165 | 2026-08-11 | own |
| MaterialDesignInXamlToolkit | 16,240 | 2026-08-21 | Material |

.NET 9 added a first-party Fluent theme (`ThemeMode`; changing it in code is experimental, trips `WPF0001`) ([what's new in .NET 9](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/whats-new/net90)).

**Realistic path: write Geist as raw `ResourceDictionary` + `ControlTemplate`s from scratch.** WPF's templating fully permits it, but there is no cascade — every visual state is an explicit `VisualStateManager`/`Trigger`, so "subtle hover states" are per-control boilerplate. Budget this as weeks, not days, and accept it will be *close to* Geist, not pixel-identical.

### 7. Animated GIF

**Not native.** "The GIF format itself is supported by the imaging API, but the `Image` control only shows the first frame of the animation" ([Thomas Levesque](https://thomaslevesque.com/2011/03/27/wpf-display-an-animated-gif-image/)). Ticket 02 reached the same conclusion independently.

| Library | License | Stars | Last push | Frame model |
|---|---|---|---|---|
| **WpfAnimatedGif** | Apache-2.0 | 685 | **2023-05-11** (3 yr stale) | Author's own assessment: "was using a huge amount of memory, because it prepared **all frames in advance**, kept them in memory" ([repo](https://github.com/XamlAnimatedGif/WpfAnimatedGif)) |
| **XamlAnimatedGif** | Apache-2.0 | 471 | **2026-06-25** (active) | Own LZW decoder; "renders the frames **just-in-time** using a `WriteableBitmap`, so **only one frame at a time is loaded in memory**" ([repo](https://github.com/XamlAnimatedGif/XamlAnimatedGif), [announcement](https://thomaslevesque.com/2015/01/17/a-new-library-to-display-animated-gifs-in-xaml-apps/)) |

For 1,686 sprites, **XamlAnimatedGif is the only viable one**; WpfAnimatedGif's all-frames-upfront model in a virtualized grid is a memory bomb. It accepts a `Stream`, so it composes with `GetManifestResourceStream` (§4).

### 8. Virtualized data grid

- `DataGrid.EnableRowVirtualization` — "The registered default is `true`"; rows created only when needed and **recycled** ([docs](https://learn.microsoft.com/en-us/dotnet/api/system.windows.controls.datagrid.enablerowvirtualization)).
- `DataGrid.EnableColumnVirtualization` — "The registered default is **`false`**" ([docs](https://learn.microsoft.com/en-us/dotnet/api/system.windows.controls.datagrid.enablecolumnvirtualization)). Must be opted into for a wide dex table; known to cause scroll jank when columns are auto-sized, since widths recompute as columns realise.
- Underlying: `VirtualizingStackPanel.IsVirtualizing`, `VirtualizationMode="Recycling"` ([docs](https://learn.microsoft.com/en-us/dotnet/api/system.windows.controls.virtualizingstackpanel)).
- Caveat: the `IsVirtualizingStackPanel_45Compatible` app-context switch exists to work around virtualization perf/crash regressions ([MS Q&A](https://learn.microsoft.com/en-us/answers/questions/1027291/issue-with-kb5017262-amp-kb5017270-cause-wpf-appli)).

**Mature, free, 15 years of production use — the best non-web grid in this document.** Commercial alternatives (Syncfusion, DevExpress ~$550/dev/yr, Telerik ~$979/dev) would be *worse* for a Geist look: a larger, more opinionated control to re-template.

### 9. Deal-breakers and production users

- **Structural, not tunable:** no trimming, no AOT, R2R currently crashing, so the ~150 MB floor and the 2–3 s cold start stand ([#78379](https://github.com/dotnet/runtime/issues/78379) closed as not planned).
- **Not deprecated:** WPF ships with .NET 9/10 and Microsoft reaffirmed support in the Jan-2025 roadmap ([dotnet/wpf](https://github.com/dotnet/wpf)). Honest characterisation: maintenance plus targeted enhancements, not active advancement.
- Production users: Visual Studio's shell has been WPF since VS 2010 and remains so — widely corroborated but `UNCONFIRMED` from a Microsoft primary source.

---

## 4. .NET 8/9 WinUI 3 (Windows App SDK)

Current: Windows App SDK **1.8.11** and **2.4.0**, both released 2026-08-13 ([releases](https://github.com/microsoft/WindowsAppSDK/releases)).

### 1. Single-file binary size, trimming, NativeAOT

**Trimming + NativeAOT: supported since Windows App SDK 1.6 (Sept 2024).**

> "The .NET `PublishAot` project property is **now supported** for native Ahead-Of-Time compilation… Because AOT builds on Trimming support, much of the following trimming-related guidance applies to AOT as well."
> — [1.6 release notes](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/release-notes/windows-app-sdk-1-6)

**With a caveat that lands squarely on this app**, verbatim from the same notes: "the developer is responsible for ensuring that all types are properly rooted to avoid trimming (such as with **reflection-based `{Binding}` targets**)." Root preservation is manual via `ILLink.Descriptors.xml`; classes must be `partial`; "Dependency packages that have not yet adopted AOT support may exhibit runtime issues." A `{Binding}`-driven dex grid is exactly the workload that breaks under AOT trimming — you would need compiled `{x:Bind}` throughout ([CsWinRT AOT guide](https://github.com/microsoft/CsWinRT/blob/master/docs/aot-trimming.md)).

Microsoft's own AOT gains (Contoso Camera sample, **hardware not stated**): "**50% reduction in start time**", "~8x reduction in package size" framework-dependent, "~2x reduction" self-contained ([Windows blog](https://blogs.windows.com/windowsdeveloper/2024/09/04/whats-new-in-windows-app-sdk-1-6/)).

Measured size: unpackaged + self-contained publish output = **~230 MB folder** ([dotnet/maui#19763](https://github.com/dotnet/maui/issues/19763)) — and note the reporter's own remark in that thread: "Strangely, the app isn't a single file?" Docs confirm direction without numbers: "your output folder is **significantly larger**" ([unpackage-winui-app](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/unpackage-winui-app)).

### 2. Cold start

**No absolute published figures exist.** The most recent Microsoft perf post gives only relative numbers, and only for the WinUI portion of File Explorer's launch: allocations −41%, transient allocations −63%, function calls −45%, **time in WinUI code −25%**, explicitly qualified as "from the WinUI portion of the FE launch" ([discussion #11096](https://github.com/microsoft/microsoft-ui-xaml/discussions/11096)). No ms, no hardware.

Guidance-only doc with a useful model — "As a rough benchmark, consider each element to take 1 ms to create" ([app-startup-performance](https://learn.microsoft.com/en-us/windows/apps/develop/performance/app-startup-performance)).

**`UNCONFIRMED`, and worse than WPF structurally**, because WinUI 3's supported single-file config *requires* `IncludeAllContentForSelfExtract=true` (§3) — the .NET Core 3.1 compat mode Microsoft calls "not recommended" — so **all ~230 MB plus the 155 MB payload extract to `%TEMP%\.net` on first launch**. §0.3 puts the write cost alone at ~7 s for 385 MB on this hardware.

### 3. Truly runtime-free? One exe or a folder?

**Unpackaged: yes**, via `<WindowsPackageType>None</WindowsPackageType>` ([unpackage-winui-app](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/unpackage-winui-app)).

**The Windows App SDK runtime IS a prerequisite by default, and self-contained removes it:**

> "**Runtime dependency** — The Windows App SDK runtime must be present on the user's machine. You must either bundle the runtime installer with your app, or use self-contained deployment (which significantly increases output size)."
> — same doc

> "the contents of the Windows App SDK Framework package will be extracted to your build output, and deployed as part of your application… **This removes the runtime dependency — users don't need to install anything separately.**"
> — [self-contained deployment](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/self-contained-deploy/deploy-self-contained-apps)

Residual floor: Windows App SDK APIs require Windows 10 1809 (build 17763)+ ([overview](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/)). Fine here.

**One exe or a folder — Microsoft's own current docs contradict each other.**

*Doc A says yes:* "Starting with Windows App SDK 1.5, unpackaged, self-contained WinUI 3 apps support the .NET `PublishSingleFile` deployment model. This produces a single distributable EXE file — all dependencies are bundled into the EXE and **extracted to a temp directory at first launch**." Six properties are mandatory (`WindowsPackageType=None`, `WindowsAppSDKSelfContained`, `SelfContained`, `EnableMsixTooling`, `IncludeAllContentForSelfExtract`, `PublishSingleFile`), and the doc states plainly: "`IncludeAllContentForSelfExtract=true` means dependencies are extracted to a temp directory on the user's machine at first launch — **the app is not a zero-extraction binary**." ([unpackage-winui-app](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/unpackage-winui-app), origin in [1.5 release notes](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/release-notes/windows-app-sdk-1-5))

*Doc B says no:* "Note that `dotnet publish` bundles managed assemblies but **cannot produce a single-file EXE for WinUI 3 apps** — the native Windows App SDK runtime dependencies must remain as separate files." ([self-contained deployment](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/self-contained-deploy/deploy-self-contained-apps))

Doc A itself recommends, under "Alternatives if single-file extraction is not acceptable": "**Use a different framework** — WPF and WinForms apps support `PublishSingleFile` with a broader set of configurations."

**Field evidence says it is fragile.** The decisive item:

> [microsoft-ui-xaml#10173](https://github.com/microsoft/microsoft-ui-xaml/issues/10173) "Published unpackaged app in Single File does not execute" — **OPEN**, filed 2024-11-16, last activity 2025-09-15, 13 comments.
> Exe shows a loading cursor then vanishes. Independent repro (2025-02-17, .NET 8.0.13): `System.IO.FileNotFoundException` at `WinRT.ActivationFactory.Get` → `AppInstance.GetCurrent()`. Process Monitor diagnosis: "it is trying to load **`Microsoft.WindowsAppRuntime.dll` from the folder with the single EXE file instead of looking into the temporary folder where the content of the single EXE file gets extracted (`AppData\Local\Temp\net\`)**."

Supporting history: [#9758](https://github.com/microsoft/microsoft-ui-xaml/issues/9758) (closed 2024-08), [#9611](https://github.com/microsoft/microsoft-ui-xaml/issues/9611) (closed 2024-05), [WindowsAppSDK#1803](https://github.com/microsoft/WindowsAppSDK/issues/1803), [WindowsAppSDK#2597](https://github.com/microsoft/WindowsAppSDK/issues/2597) ("PublishSingleFile with WindowsAppSDKSelfContained produces non runnable application"), [dotnet/maui#19763](https://github.com/dotnet/maui/issues/19763) (`PublishSingleFile=true` set, output stayed a 230 MB folder), [WindowsAppSDK#3026](https://github.com/microsoft/WindowsAppSDK/discussions/3026) (fails on `AnyCPU`, needs explicit `-p:Platform=x64`).

**Bottom line:** WinUI 3 *can* emit one exe, but it is a self-extracting archive, Microsoft's docs disagree on whether it works, and the bug that breaks it is open and unfixed since Nov 2024. **`UNCONFIRMED` whether it works on WinAppSDK 1.8/2.4 + .NET 9.**

### 4. Embedding the assets

Same .NET mechanics as WPF §4 — `EmbeddedResource` + `GetManifestResourceStream` is memory-mapped. **Two WinUI-specific frictions:**

- WinUI uses **MRTCore** (`ms-appx:///`, `ms-resource:`) ([overview](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/mrtcore/mrtcore-overview)), and `Image.Source` / `FontFamily` accept **only** `ms-appdata:`, `ms-appx:` and `ms-resource:` URIs ([microsoft-ui-xaml#10054](https://github.com/microsoft/microsoft-ui-xaml/issues/10054)). Anything XAML loads by URI must be a **file on disk**, not a .NET manifest resource. Feeding embedded bytes to `Image` requires `BitmapImage.SetSourceAsync(IRandomAccessStream)` in code — an extra `Stream` → `IRandomAccessStream` hop per sprite.
- `ms-appx://` references were **broken under `PublishSingleFile` until 1.6 fixed it** ([1.6 notes](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/release-notes/windows-app-sdk-1-6)).

### 5. Toolchain to install

Materially heavier than WPF:

- **Visual Studio required per the docs** — VS 2026 or latest VS 2022 with the **"WinUI application development"** workload, plus **Developer Mode** enabled ([start-here](https://learn.microsoft.com/en-us/windows/apps/get-started/start-here)).
- `EnableMsixTooling=true` is required **even for the unpackaged single-file config**, so MSIX tooling must be installed despite never shipping an MSIX.
- **`PublishAot` additionally requires "Desktop development with C++" with all default components** (MSVC linker) ([native-aot](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/)).
- `UNCONFIRMED`: whether an unpackaged WinUI 3 app builds with the .NET SDK CLI alone. Measure: install only the SDK, `dotnet new install Microsoft.WindowsAppSDK.ProjectTemplates`, `dotnet build`, see what targets are missing.

### 6. Geist fidelity

**Font embedding: supported, slightly better than WPF.** Reference form `FontFamily="/Assets/Fonts/Geist-Regular.ttf#Geist"` (path, `#`, then the *font name*) ([MS Q&A](https://learn.microsoft.com/en-us/answers/questions/1195617/how-to-use-my-downloaded-fonts-in-winui-3)); no machine-wide install needed.

But: fonts must be **loose files** reachable by `ms-appx:` / `ms-resource:`, not manifest resources ([#10054](https://github.com/microsoft/microsoft-ui-xaml/issues/10054)). With `IncludeAllContentForSelfExtract` they land in `%TEMP%\.net` — **the same code path that #10173 gets wrong.** Multi-weight needs one `FontFamily` resource per Geist weight; multi-file family support is an open proposal ([#7538](https://github.com/microsoft/microsoft-ui-xaml/issues/7538)).

**What cannot be reproduced:**

1. **Variable font axes** — proposal [#1808](https://github.com/microsoft/microsoft-ui-xaml/issues/1808) is a proposal, not shipped.
2. **Text rasterisation** — DWriteCore with ClearType subpixel rendering ([DWriteCore](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/dwritecore)); same unfixable browser mismatch as WPF.
3. **1px hairlines: better default than WPF.** `UseLayoutRounding` **defaults to `true`** in XAML/WinUI — "will cause measurement and layout operations to round potential subpixel values… The most prominent example of such an artifact is when you intend to produce a crisp, thin line of a particular color" ([docs](https://learn.microsoft.com/en-us/uwp/api/windows.ui.xaml.uielement.uselayoutrounding)). The 125%/150% inconsistency still applies. WinUI's design guidance is built on a **4 px spacing grid** ([spacing](https://learn.microsoft.com/en-us/windows/apps/design/style/spacing)) which does not match Geist's scale; you would override it wholesale.
4. **No Geist or shadcn port for WinUI 3 exists.**
5. **Ecosystem thinness.** WinUI 3 is fully re-templatable ([XAML theme resources](https://learn.microsoft.com/en-us/windows/apps/develop/platform/xaml/xaml-theme-resources)), but there is **no WinUI 3 equivalent of WPF-UI / MahApps / HandyControl / MaterialDesignInXaml** to start from. No XAML designer either.

### 7. Animated GIF — the one clear win

**Native.** `Image` animates GIFs with zero third-party code:

> "The `Image` element supports animated Graphics Interchange Format (GIF) images. When you use a `BitmapImage` as the image `Source`, you can access `BitmapImage` APIs to control playback of the animated GIF image."
> — [Image class](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.controls.image)

`BitmapImage.IsAnimatedBitmap`, `AutoPlay` (defaults `true`), `IsPlaying`, `Play()`, `Stop()` ([BitmapImage](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.xaml.media.imaging.bitmapimage)). Corroborated from the other side: XamlAnimatedGif dropped UWP support because "native support makes this library unnecessary" ([repo](https://github.com/XamlAnimatedGif/XamlAnimatedGif)). Ticket 02 reached the same conclusion.

`UNCONFIRMED`: per-instance cost of N simultaneously animating GIFs in a virtualized list. Measure with `AutoPlay=false` + `Play()`-on-realize vs always-on.

### 8. Virtualized data grid — the weakest point

**There is NO first-party WinUI 3 DataGrid.**

The Community Toolkit `DataGrid` is effectively frozen: `CommunityToolkit.WinUI.UI.Controls.DataGrid` **latest 7.1.2, published 2021-11-18** — no release in ~4.7 years, MIT, 596.8K downloads, not formally deprecated ([NuGet](https://www.nuget.org/packages/CommunityToolkit.WinUI.UI.Controls.DataGrid)). The 7.x repo is **archived / read-only** ([WindowsCommunityToolkit](https://github.com/CommunityToolkit/WindowsCommunityToolkit)). The active 8.x successor `CommunityToolkit/Windows` (pushed 2026-08-04, 1,049 stars) **has no DataGrid component** — verified against the [`components/` tree](https://github.com/CommunityToolkit/Windows/tree/main/components): Animations, Behaviors, CameraPreview, Collections, ColorPicker, Converters, DeveloperTools, Extensions, HeaderedControls, Helpers, ImageCropper, LayoutTransformControl, Media, MetadataControl, Primitives, RadialGauge, RangeSelector, RichSuggestBox, Segmented, SettingsControls, Sizers, TabbedCommandBar, TokenizingTextBox, Triggers. Maintainer policy for unported 7.x components: "not currently planned for porting… open to community interest" ([#784](https://github.com/CommunityToolkit/Windows/issues/784)).

First-party alternatives are lists, not grids: `ItemsView` ([docs](https://learn.microsoft.com/en-us/windows/apps/design/controls/itemsview)) and `ItemsRepeater` — "only realize items that fall within the scroll viewport" ([docs](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/items-repeater)). **Row virtualization only.** Per-column sort/filter/resize you build yourself.

Commercial: Syncfusion `SfDataGrid` for WinUI is actively shipped, with a **Community License** free for orgs with <$1M revenue, ≤5 devs, ≤10 employees ([terms](https://www.syncfusion.com/products/communitylicense)). Telerik UI for WinUI is "no longer sold as a standalone product" since 2023-12-01 ([release history](https://www.telerik.com/support/whats-new/winui/release-history/telerik-ui-for-winui-3-0-0-(2025-q1))). DevExpress WinUI: `devexpress.com/products/net/controls/winui/` returns **HTTP 404** — `UNCONFIRMED` but strongly suggestive of discontinuation.

### 9. Deal-breakers and production users

1. **The single-exe story is unreliable** — two current MS docs contradict each other, the supported path is self-extracting, and the launch bug is open since Nov 2024. R3 is the exact requirement this stack is shakiest on.
2. **No mature data grid** — the de-facto grid has not shipped since 2021 and was not carried into the active toolkit line.
3. **First-launch extraction of ~385 MB** to a temp dir (~7 s of I/O on this box by §0.3), with no UI explaining why the "portable" exe appears to be installing.
4. Heaviest dev prerequisites of any .NET option: full VS + WinUI workload + Developer Mode + MSIX tooling (+ MSVC if AOT).

Counterweights: native animated GIF, and real NativeAOT (Microsoft-measured at −50% start time).

Production users: WinUI powers parts of the Windows 11 shell — Microsoft benchmarks against **File Explorer's WinUI portion** ([#11096](https://github.com/microsoft/microsoft-ui-xaml/discussions/11096)) — and **PowerToys Settings is a WinUI 3 app** ([winui3 docs](https://learn.microsoft.com/en-us/windows/apps/winui/winui3/)). Microsoft calls Windows App SDK "the recommended development platform for building new Windows desktop applications" ([overview](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/)).

---

## 5. Avalonia UI

Current: **12.1.1**, NuGet, last updated 2026-07-29 ([nuget](https://www.nuget.org/packages/avalonia)).

### 1. Single-file binary size, trimming, NativeAOT

**Both supported and documented.** `<PublishAot>true</PublishAot>` + `<IsAotCompatible>true</IsAotCompatible>`; docs require `x:CompileBindings="True"`, no runtime XAML loading, and explicitly instruct: "**Bundle all assets as embedded resources / Use `AvaloniaResource` build action**" ([native-aot](https://docs.avaloniaui.net/docs/deployment/native-aot)). Trimming via `PublishTrimmed` with root descriptors, same page.

Published sizes (all community):

| Case | Size | Source |
|---|---|---|
| Blank MVVM + AOT + trimmed | **21 MB** (18 MB without `Avalonia.Fonts.Inter`) | [#14219](https://github.com/AvaloniaUI/Avalonia/discussions/14219) |
| **DiskDigger**, real app, self-contained `PublishSingleFile` | **~60 MB** exe / ~30 MB zipped | [dmitrybrant.com](https://dmitrybrant.com/2025/06/26/diskdigger-avalonia-ui-a-success-story) |
| Minimal self-contained single-file | 58.2 MB | [#14633](https://github.com/AvaloniaUI/Avalonia/discussions/14633) |
| + Avalonia.ReactiveUI | ~80 MB | [#9217](https://github.com/AvaloniaUI/Avalonia/discussions/9217) |

**The "true single file" caveat.** Classic `PublishSingleFile` does not bundle native libs by default; with `IncludeNativeLibrariesForSelfExtract=true`, `libSkiaSharp`, `libHarfBuzzSharp` and `av_libglesv2` are **extracted to `%TEMP%/.net` on run**, with a documented "higher startup cost" ([single-file overview](https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file/overview)). And **NativeAOT does not statically link Skia by default** — feature request open since 2022-11-21 with no maintainer implementation ([#9503](https://github.com/AvaloniaUI/Avalonia/issues/9503)).

A third-party workaround produces a genuinely static exe: [`peaceshi/Avalonia-NativeAOT-SingleFile`](https://github.com/peaceshi/Avalonia-NativeAOT-SingleFile) (MIT, 52 stars) uses `SkiaSharp.Static` + `ANGLE.Static` forks, reporting ~15 MB with UPX. **This is a fork of the native builds, not an Avalonia-supported path** — a real supply-chain and maintenance liability for a 4-user app.

**Projected: ~20–80 MB framework + 155 MB assets ≈ 175–235 MB.** `UNCONFIRMED`.

### 2. Cold start

Avalonia 12 blog reports **NativeAOT startup 1,960 ms → 460 ms (4x)** — but the figure is stated **for Android**, and **no hardware is given** ([avalonia-12](https://avaloniaui.net/blog/avalonia-12/)).

**Windows cold start: `UNCONFIRMED`.** No primary published number. Confounder to isolate explicitly: the `%TEMP%\.net` self-extraction happens on **first run per version hash**, so measure run 1 and run 2 separately.

### 3. Truly runtime-free?

Yes for .NET. But two native gates:

- The Skia backend historically requires the **Microsoft Visual C++ 2015 Redistributable** (`msvcp140.dll` / `vcruntime140.dll` present or shipped) ([runtime requirements wiki](https://github.com/AvaloniaUI/Avalonia/wiki/Runtime-Requirements/dc3da36338f0a3b3d917bd6d5f4307ae890a65f1)). Present on this machine (§0.2).
- **Avalonia 12 pulls a DirectX 12 dependency** via SkiaSharp 3.119+; it will not run on Win7/8/8.1 and some Win10 configs. Issue closed **"by-design"**, filed 2026-02-18 ([#20710](https://github.com/AvaloniaUI/Avalonia/issues/20710)). Not a blocker on Win11, but note the i3-9100F has **no iGPU** (§0.2) — confirm the discrete GPU supports the required feature level.

### 4. Embedding the assets

`<AvaloniaResource Include="Assets\**" />`; assets become **.NET manifest resources inside the assembly**, addressed as `avares://MyApp/Assets/foo.gif` or via `AssetLoader.Open` ([including-assets](https://docs.avaloniaui.net/docs/fundamentals/including-assets)). Docs: "The element name `AvaloniaResource` here only indicates that the assets will be internally stored as .NET resources by the build."

Same demand-paging economics as WPF §4 (single-file bundles are memory-mapped, [design.md](https://github.com/dotnet/designs/blob/main/accepted/2020/single-file/design.md)), and the same rule: **do not set `EnableCompressionInSingleFile`**. The NativeAOT doc explicitly endorses this exact pattern.

**Documented size limit or startup cost: `UNCONFIRMED`.**

### 5. Toolchain to install

**.NET SDK required** (absent here). **NativeAOT additionally requires the MSVC C++ toolchain**, i.e. VS Build Tools "Desktop development with C++" ([native-aot prerequisites](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/)). Latest SDK 10.0.400, 2026-08-11 ([download](https://dotnet.microsoft.com/en-us/download/dotnet/10.0)); installer byte size `UNCONFIRMED` (measure with an HTTP HEAD on the direct link).

### 6. Geist fidelity

**Font embedding: supported, with a hard limitation.** `.ttf`/`.otf` embed via `AvaloniaResource`, referenced as `avares://MyApp/Assets/Fonts#Geist` or registered through `EmbeddedFontCollection` + `.ConfigureFonts(...)` ([custom-fonts](https://docs.avaloniaui.net/docs/styling/custom-fonts)). **WOFF2 is not listed as supported.**

**Variable fonts are NOT supported** — "You can't modify any variable axis. So it is not supported" ([#11092](https://github.com/AvaloniaUI/Avalonia/issues/11092), [#16355](https://github.com/AvaloniaUI/Avalonia/discussions/16355)). Ship Geist's static per-weight TTFs, one `FontFamily` per weight.

**1px hairlines at fractional DPI are Avalonia's weak spot**, with more open issues than any other stack here:

- 1px borders **invisible at 125% DPI**, fine at 100% and 350% ([#8867](https://github.com/AvaloniaUI/Avalonia/issues/8867))
- Margin/padding/`BorderThickness` misbehave under `RenderScaling`, visible AA on thin edges ([#7798](https://github.com/AvaloniaUI/Avalonia/issues/7798))
- Horizontal/vertical lines de-snap and alias at DPI 1.5 ([#5709](https://github.com/AvaloniaUI/Avalonia/issues/5709))
- Pixel-perfect layouts pull apart above 100% scale ([#17361](https://github.com/AvaloniaUI/Avalonia/discussions/17361))
- With `UseLayoutRounding=false`, Skia renders borders 1px outside bounds ([#18511](https://github.com/AvaloniaUI/Avalonia/pull/18511))

Budget real work on `UseLayoutRounding=true` plus a custom pen-snapping strategy, and verify at 100/125/150/175%.

UI kits — none is Geist:

| Kit | License | Status |
|---|---|---|
| Fluent / Simple (official) | MIT | ships with Avalonia ([themes](https://docs.avaloniaui.net/docs/styling/themes)) |
| Semi.Avalonia | MIT core; Dock/Tabalonia sub-packages free but **not open source** | active, 12.1.0.1 on 2026-07-31, 1.9k stars ([repo](https://github.com/irihitech/Semi.Avalonia)) |
| Material.Avalonia | MIT | active, 1.2k stars ([repo](https://github.com/AvaloniaCommunity/Material.Avalonia)) |
| **ShadUI** — closest to a shadcn port | **MIT** | active, 535 stars; inspired by shadcn/ui; **does not mention Geist** ([repo](https://github.com/accntech/shad-ui)) |

**No Geist port for Avalonia exists.** Closest starting point is ShadUI, which encodes shadcn tokens but not Geist typography. Avalonia's docs give **no guidance on creating themes from scratch** ([themes](https://docs.avaloniaui.net/docs/styling/themes)).

### 7. Animated GIF

**Not native** — the built-in `Image` does not animate GIFs, and core maintainers declined to add it ([#8020](https://github.com/AvaloniaUI/Avalonia/issues/8020), [#6947](https://github.com/AvaloniaUI/Avalonia/discussions/6947)).

| Library | License | Status |
|---|---|---|
| **`Avalonia.Labs.Gif`** | MIT | official-org package, **12.0.2 published 2026-04-23**, owner `avaloniaui` ([NuGet](https://www.nuget.org/packages/Avalonia.Labs.Gif/12.0.2)). Known defect: certain GIFs decode incorrectly ([Labs#116](https://github.com/AvaloniaUI/Avalonia.Labs/issues/116)) |
| `jmacato/AvaloniaGif`, `AvaloniaUI/Avalonia.GIF` | MIT | **archived/deprecated 2024-09-02**, superseded ([repo](https://github.com/AvaloniaUI/Avalonia.GIF/)) |
| `AnimatedImage.Avalonia` | — | GIF + APNG + animated WebP ([NuGet](https://www.nuget.org/packages/AnimatedImage.Avalonia)) |

Pure-C# decoder; concurrent-instance behaviour `UNCONFIRMED`.

### 8. Virtualized data grid — the status changed recently

**`Avalonia.Controls.DataGrid` is officially DEPRECATED.** Docs, verbatim: "DataGrid is deprecated! For read-only tabular data, we recommend using **TableView**. For advanced editing, we recommend using TreeDataGrid." ([datagrid docs](https://docs.avaloniaui.net/controls/data-display/structured-data/datagrid)). It moved to its own repo and receives bug fixes only ([#18388](https://github.com/AvaloniaUI/Avalonia/discussions/18388)). Its known perf issues are exactly this workload: `CopySourceToInternalList()` enumerates the entire source, defeating data virtualization ([#140](https://github.com/AvaloniaUI/Avalonia.Controls.DataGrid/discussions/140)); sorting slower than WPF ([#7241](https://github.com/AvaloniaUI/Avalonia/issues/7241)); slow horizontal scroll ([#8759](https://github.com/AvaloniaUI/Avalonia/issues/8759)); cannot reach the last row at 10k rows ([#17308](https://github.com/AvaloniaUI/Avalonia/issues/17308)).

**`TableView` is the replacement and fits this case.** New in **Avalonia 12.1**, **part of core `Avalonia.Controls`** — no extra NuGet, no extra style include — read-only, derives from `ListBox`. "**Rows are virtualized and recycled by default, and cells are also recycled alongside their owning rows**", but **columns are NOT virtualized** ([TableView docs](https://docs.avaloniaui.net/controls/data-display/structured-data/tableview), [origin issue #21237](https://github.com/AvaloniaUI/Avalonia/issues/21237), [12.1 release](https://avaloniaui.net/blog/release-12-1)). Read-only tabular data is exactly what PokeStats needs — R11 rules out editing.

**`TreeDataGrid` is now commercial.** Repo **archived 2025-10-13**, "will not receive bug fixes, feature updates, or dependency updates"; moved into **Avalonia Accelerate** ([repo](https://github.com/AvaloniaUI/Avalonia.Controls.TreeDataGrid)). The commercial fork is **AGPL-3 for OSS / paid otherwise**; Accelerate has a free Community Edition for individuals and small orgs ([pricing](https://avaloniaui.net/pricing), [rationale](https://avaloniaui.net/blog/building-a-sustainable-future-for-avalonia), [#307](https://github.com/AvaloniaUI/Avalonia.Controls.TreeDataGrid/issues/307)).

Also exists: [`Sheet.Avalonia`](https://github.com/orunco/Sheet.Avalonia), virtualized Excel-like grid claiming 1,048,576 × 16,384.

### 9. Deal-breakers and production users

- No first-party static-linked single-file NativeAOT — either accept `%TEMP%` self-extraction or depend on third-party Skia/ANGLE static forks ([#9503](https://github.com/AvaloniaUI/Avalonia/issues/9503)).
- No variable font support ([#11092](https://github.com/AvaloniaUI/Avalonia/issues/11092)).
- Fractional-DPI hairline artifacts, multiple open issues (§6).
- Grid story in flux: DataGrid deprecated, TreeDataGrid commercialised, TableView only 12.1-new.

Production users, and they are strong: **JetBrains, Autodesk, Devolutions, Schneider Electric, Unity, GitHub** ([avaloniaui.net](https://avaloniaui.net/)). Named apps: **Unity Plastic SCM**, **GitHub's Git Credential Manager**, **Lunacy** (Icons8), **ENTTEC EMU**, **ExifGlass** ([showcase](https://avaloniaui.net/showcase), [spotlight](https://avaloniaui.net/blog/a-spotlight-on-avalonia-applications)), **DiskDigger** ([writeup](https://dmitrybrant.com/2025/06/26/diskdigger-avalonia-ui-a-success-story)).

---

## 6. Flutter desktop (Windows)

Current stable: **Flutter 3.47.0** ([release notes](https://docs.flutter.dev/release/release-notes)).

### 1. Single exe? No — and this is disqualifying

`flutter build windows` produces a **folder**, documented verbatim:

```
Release/
  my_app.exe, flutter_windows.dll, msvcp140.dll, vcruntime140.dll, vcruntime140_1.dll
  data/  ->  app.so, icudtl.dat, flutter_assets/...
```
— [building for Windows](https://docs.flutter.dev/platform-integration/windows/building)

Output path is architecture-scoped: `build\windows\x64\runner\Release\` ([breaking change](https://docs.flutter.dev/release/breaking-changes/windows-build-architecture)).

**Flutter states there is no built-in single-exe option.** Official distribution paths are MSIX, Inno Setup/WiX, or a zip. All feature requests are closed:

| Issue | Opened | State |
|---|---|---|
| [#75200](https://github.com/flutter/flutter/issues/75200) "Ability to build into a single file executable for Windows and Linux" | 2021-02-02 | closed |
| [#105655](https://github.com/flutter/flutter/issues/105655) "Windows build support self-contained build (single exe file)" | 2022-06-09 | **closed as not planned** |
| [#127086](https://github.com/flutter/flutter/issues/127086) "Request for a feature; Single EXE for windows" | 2023-05-18 | closed as duplicate |
| [#81134](https://github.com/flutter/flutter/issues/81134) "Add ability to compile a portable Windows exe" | 2021-04-24 | closed |

Engine-level blocker: `flutter_windows.dll` is too big to statically link ([#57875](https://github.com/flutter/flutter/issues/57875)).

**The only third-party escape** is Enigma Virtual Box, whose vendor claims it "does not extract virtual files to the disk and does not create any temporary files on the user's computer… file emulation is performed in the process memory only" ([aboutvb](https://www.enigmaprotector.com/en/aboutvb.html), [background](https://www.softwareprotection.info/2019/02/files-virtualization-and-portable-applications/)). It is closed-source, Windows-only freeware with no published data at a 155–400 MB virtualized payload, and has reported DLL-loading friction with Flutter builds ([forum thread](https://forum.enigmaprotector.com/viewtopic.php?t=18578)). **`UNCONFIRMED` at this scale**; measure by packing the real Release folder and running under Process Monitor filtered on `%TEMP%` writes.

### 2. Cold start

**`UNCONFIRMED`.** No primary Windows-desktop cold-start figure published; all Flutter startup benchmarks found are Android/iOS.

Relevant Windows-specific change: Flutter 3.47 makes **Impeller the default on Windows**, which "compiles a fixed set of shaders at build time rather than dynamically at runtime" ([what's new](https://flutter.dev/blog/whats-new-in-flutter-3-47), [Impeller docs](https://docs.flutter.dev/perf/impeller)). Opt-out exists but "the ability to opt out will be removed."

### 3. Runtime prerequisites

**VC++ redistributable required.** The app-local option means shipping `msvcp140.dll`, `vcruntime140.dll`, `vcruntime140_1.dll` next to the exe ([building](https://docs.flutter.dev/platform-integration/windows/building)). Also mandatory beside the exe: `flutter_windows.dll`, `data/app.so`, `data/icudtl.dat`. **None can live inside the exe.**

### 4. Embedding the assets — hard conflict, confirmed

**Assets bundle into `data/flutter_assets/` as a folder on disk, not into the exe** ([building](https://docs.flutter.dev/platform-integration/windows/building), [assets](https://docs.flutter.dev/ui/assets/assets-and-images)).

**Is there any supported way to embed them in the exe? No.** The Dart-side equivalent request, "[dart2native] Embed resource files into Dart2Native executables", is open and unimplemented ([dart-lang/sdk#39576](https://github.com/dart-lang/sdk/issues/39576)).

Only routes: EVB-style external virtualization of the whole folder, or hand-rolling a Windows resource in a forked `windows/runner` and serving it to Dart via FFI — no documented precedent, `UNCONFIRMED`.

### 5. Toolchain to install

**Flutter SDK + Visual Studio 2022** with the **"Desktop development with C++"** workload ([Windows setup](https://docs.flutter.dev/platform-integration/windows/setup), [install](https://docs.flutter.dev/get-started/install/windows)), plus Git for Windows and CMake. Flutter SDK alone is **1.5 GB minimum**, excluding IDE/tools. VS 2022 + C++ workload size `UNCONFIRMED` (typically several GB).

**Heaviest toolchain of any candidate.**

### 6. Geist fidelity

**Fonts: Flutter's advantage.** Declared in `pubspec.yaml` with per-weight `asset`/`weight` ([pubspec](https://docs.flutter.dev/tools/pubspec)). **`shadcn_flutter` already bundles Geist and Geist Mono**, and migrated from 18 weight-specific `.otf` files to **2 variable `.ttf` files** ([changelog](https://pub.dev/packages/shadcn_flutter/changelog)) — **Flutter supports variable fonts; Avalonia, WPF and WinUI do not.**

Two real shadcn ports exist:

| Package | Version | License | Signals |
|---|---|---|---|
| `shadcn_ui` | 0.56.1, ~16 days ago | **MIT**, publisher mariuti.com (verified) | 949 likes, 160 pub points, 62.3k downloads, Windows listed ([pub.dev](https://pub.dev/packages/shadcn_ui), [docs](https://flutter-shadcn-ui.mariuti.com/)) |
| `shadcn_flutter` | 0.0.53, ~37 days ago | **BSD-3-Clause**, publisher sunaryathito.space (verified) | 463 likes, ~84 components, standalone (no Material needed), **ships Geist**, New York theme ([pub.dev](https://pub.dev/packages/shadcn_flutter)) |

**1px hairlines: mixed.** `BorderSide.width = 0.0` is documented as "a hairline = exactly one physical pixel" ([API](https://api.flutter.dev/flutter/painting/BorderSide/width.html)), with the same doc warning it "might double-hit pixels". Known defect: `width: 0.0` renders 2 physical px in some cases; workaround `1.0 / MediaQuery.devicePixelRatio` ([#22056](https://github.com/flutter/flutter/issues/22056)). Impeller-specific: inconsistent border rendering at thin widths ([#162378](https://github.com/flutter/flutter/issues/162378)). FXAA on Windows caused blurry text ([#140302](https://github.com/flutter/flutter/issues/140302)).

**Font rendering does not match a browser: Flutter has no ClearType / LCD subpixel antialiasing** ([#63043](https://github.com/flutter/flutter/issues/63043), [#81185](https://github.com/flutter/flutter/issues/81185); high-DPI blur [#129889](https://github.com/flutter/flutter/issues/129889), inconsistent AA [#123345](https://github.com/flutter/flutter/issues/123345)). Flutter 3.47 switched Windows to OpenGL ES SDF text rendering for "sharper text and cleaner vector curves on desktop" ([blog](https://flutter.dev/blog/whats-new-in-flutter-3-47)). **Geist's metrics and shapes will match; the antialiasing will not.**

### 7. Animated GIF

**Native.** Supported formats include "**GIF, Animated GIF, WebP, Animated WebP**"; `Image.asset` displays them with no plugin ([Image class](https://api.flutter.dev/flutter/widgets/Image-class.html), [assets](https://docs.flutter.dev/ui/assets/assets-and-images)). Ticket 02 agrees.

**Memory caveats are documented and real:** images are held uncompressed and retained in `ImageCache` (a 4K frame ~30 MB RAM); OOM crash with multiple large GIFs in a list ([#14344](https://github.com/flutter/flutter/issues/14344)); the codec caches decoded animated frames up to a size ratio, OOM still possible ([engine#6310](https://github.com/flutter/engine/pull/6310), [#26081](https://github.com/flutter/flutter/issues/26081)); "gifs can cause jank and high cpu usage" ([#88858](https://github.com/flutter/flutter/issues/88858)); `ImageCache` limits by **image count, not bytes** ([#13606](https://github.com/flutter/flutter/issues/13606)). Mitigation: `cacheWidth`/`cacheHeight` to cap decode size.

### 8. Virtualized data grid

**`DataTable` is not virtualized.**

| Package | Version | License | Rows virtualized | Columns virtualized |
|---|---|---|---|---|
| `data_table_2` | 3.0.0, ~4 days ago | BSD-3-Clause | **No** — pagination only (`PaginatedDataTable2`, experimental `AsyncPaginatedDataTable2`) | **No** — "all columns are fixed width" ([pub.dev](https://pub.dev/packages/data_table_2), [repo](https://github.com/maxim-saplin/data_table_2)) |
| `pluto_grid` | 8.1.0, ~8 months ago | MIT, 1.08k likes | not documented — `UNCONFIRMED` | `UNCONFIRMED` ([pub.dev](https://pub.dev/packages/pluto_grid)) |
| `syncfusion_flutter_datagrid` | current | **Commercial** | vendor claims "built from the ground up for best possible performance" | `UNCONFIRMED` ([pub.dev](https://pub.dev/packages/syncfusion_flutter_datagrid)) |

Syncfusion Community License terms: annual gross revenue <$1M USD, ≤5 developers, ≤10 total employees, never received >$3M in outside capital. **Flutter is an add-on benefit to the UI Component Suite license, not a standalone grant** ([terms](https://www.syncfusion.com/products/communitylicense)).

### 9. Deal-breakers and production users

1. **No single exe, ever** — closed as *not planned* with an engine-level blocker. R3 is unmet by the platform.
2. **Assets cannot live in the exe** — `data/flutter_assets/` is a folder by design; Dart-side embedding unimplemented.
3. VC++ DLLs must ship alongside.
4. Any "one exe" story requires a closed-source third-party wrapper with no evidence at this payload size.
5. No ClearType, so text will not match a browser-rendered Geist reference.
6. Requires VS 2022 + Desktop C++ on a machine that has none of it.

Production users: Canonical's **Ubuntu installer** and **Superlist** desktop ([desktop integration](https://docs.flutter.dev/platform-integration/desktop), [showcase](https://flutter.dev/showcase)).

---

## 7. Python + Flet (the V1 baseline)

Current: **0.86.5** on PyPI ([json](https://pypi.org/pypi/flet/json)).

### 1. Single-file exe size

No official floor is published — `UNCONFIRMED` as a documented number. Empirical figures:

| Case | Size | Source |
|---|---|---|
| Flet 0.19.0, `flet pack` | 31,954 KB | [#3048](https://github.com/flet-dev/flet/issues/3048) |
| Flet 0.22.0, `flet pack` | **76,558 KB** | same |
| Flet 0.23.2, `flet pack` | 77,353 KB | same |
| recent `flet pack` | 77.8 MB | [#4620](https://github.com/flet-dev/flet/issues/4620) |
| `flet build` (Flutter path) | over 100 MB | same |
| `flet[desktop]` only + PyInstaller, hand-trimmed | 17 MB | same |
| `libmpv-2.dll` alone | 28.3 MB | same |

The >2x jump between 0.19 and 0.22 is documented and **unexplained**; #3048 is closed with no maintainer root cause.

Baseline reason: Flet renders via Flutter — the Flutter Windows engine is embedded in the packaged client ([repo](https://github.com/flet-dev/flet)).

### 2. Cold start — the decisive finding

**PyInstaller `--onefile` extracts on every launch. Confirmed from primary docs.**

> "The bootloader is the heart of the one-file bundle also. When started it creates a temporary folder in the appropriate temp-folder location for this OS. The folder is named `_MEI_xxxxxx_`, where *xxxxxx* is a random number."
> "The bootloader uncompresses the support files and writes copies into the temporary folder. This can take a little time. **That is why a one-file app is a little slower to start than a one-folder app.**"
> "When the bundled code terminates, the bootloader deletes the temporary folder." … "The `_MEI_xxxxxx_` folder is not removed if the program crashes or is killed."
> — [operating-mode](https://pyinstaller.org/en/stable/operating-mode.html)

> "When you bundle to a single executable, copies of added files are compressed into the executable, and **expanded to the `_MEI_xxxxxx_` temporary folder before execution**."
> — [spec-files](https://pyinstaller.org/en/stable/spec-files.html)

**There is no caching. None.** Three separate open feature requests ask for exactly that and none has landed: [#1782](https://github.com/pyinstaller/pyinstaller/issues/1782), [#4994](https://github.com/pyinstaller/pyinstaller/issues/4994), [#7907](https://github.com/pyinstaller/pyinstaller/issues/7907). `--runtime-tmpdir` only relocates the target, it does not cache ([usage](https://pyinstaller.org/en/stable/usage.html)).

Measured user report: **4.5 s onefile vs 1.5 s onedir**, hand-stopped ([#7907](https://github.com/pyinstaller/pyinstaller/issues/7907)). Pathological case on file: PyInstaller archive `open()` taking **3,614 s** vs 0.404 s on another machine, AV/filesystem interaction suspected ([#2550](https://github.com/pyinstaller/pyinstaller/issues/2550)).

**And §0.3 measured the actual cost on this machine: 2,801 ms just to write 154.4 MB / 1,686 files to `%TEMP%`, with AV off.** That is the floor, every launch, before Python starts, before Flutter starts, before the first frame. It is over 2x the entire tab-switch budget of R5.

**`flet build windows` does not produce a single exe.** It "uses Flutter SDK to produce a fast, offline, fully customizable executable… with Python runtime embedded into executable and running in-process" ([blog](https://flet.dev/blog/packaging-apps-for-distribution/)) — but the output is the standard Flutter Windows folder layout ([Flet CLI](https://flet.dev/docs/cli/flet-build/), [Flutter building](https://docs.flutter.dev/platform-integration/windows/building)), and Flutter has no single-file mode (§6.1).

**Nuitka is the only Python packer with a real cached mode.** Default `--onefile-tempdir-spec="{TEMP}/onefile_{PID}_{TIME}"` is deleted after execution; setting it to `"{CACHE_DIR}/{COMPANY}/{PRODUCT}/{VERSION}"` is documented explicitly as the way to avoid repeated unpacking, with CRC32 checks to skip re-extraction ([use-cases](https://nuitka.net/user-documentation/use-cases.html)). First run still pays full extraction, and Windows file locking on a fixed folder is a documented caveat. cx_Freeze has no Windows onefile at all ([faq](https://cx-freeze.readthedocs.io/en/stable/faq.html)).

### 3. Truly runtime-free?

**Python: not required on the target.** `flet pack` "ensures that end users don't need a Python environment" ([flet-pack](https://flet.dev/docs/cli/flet-pack/)).

**VC++ redistributable: required, app-local.** Flutter Windows apps need `msvcp140.dll` / `vcruntime140.dll` / `vcruntime140_1.dll` ([Flutter building](https://docs.flutter.dev/platform-integration/windows/building)); with PyInstaller these land in `_MEIPASS`.

**Zero-network risk, previously broken.** Flet 0.25.1 regression: a packaged app "on startup the app tries to download from the flet website some libraries. Without them it won't run." Fixed in 0.25.2 ([#4549](https://github.com/flet-dev/flet/issues/4549)). **This is a direct R2 violation that shipped in a release.** Mitigation: install `flet[all]` / `flet-desktop` in the build venv and **test the exe on a network-isolated VM** — it is a regression class that recurred once and can recur.

### 4. Embedding the assets

All of it goes into the CArchive and is written to `%TEMP%` on every launch (§2). "A CArchive can contain any kind of file. It's very much like a `.zip` file… **Compression is optional for each member**" ([advanced-topics](https://pyinstaller.org/en/stable/advanced-topics.html)). **No lazy or partial extraction exists.**

Ceiling: the historical 2 GB wall (`struct.error: 'i' format requires…`, signed 32-bit CTOC offsets) was **closed** via PR #5667 ([#3939](https://github.com/pyinstaller/pyinstaller/issues/3939)). 155–400 MB is well under.

**Antivirus.** PyInstaller's docs contain **no** antivirus section (checked [common-issues](https://pyinstaller.org/en/stable/common-issues-and-pitfalls.html) and [usage](https://pyinstaller.org/en/stable/usage.html)). Evidence is issue-level: [#6754](https://github.com/pyinstaller/pyinstaller/issues/6754) ("My --onefile exe is getting anti-Virus False positive flags and is disabled by windows"), [discussion #8207](https://github.com/orgs/pyinstaller/discussions/8207), [upx#711](https://github.com/upx/upx/issues/711). Practitioner guidance recommends `--onedir` precisely because "nothing needs to be extracted at runtime, [so] the behavior looks less suspicious" ([pythonguis](https://www.pythonguis.com/faq/problems-with-antivirus-software-and-pyinstaller/)). **Extract-to-temp-then-execute is the exact heuristic AV vendors flag**, and 1,686 fresh files in `%TEMP%` get scanned on every launch on machines with RTP on.

### 5. Toolchain to install

**Path A — `flet pack` (PyInstaller, one exe):** Python ≥3.10 ([installation](https://flet.dev/docs/getting-started/installation/)) — 3.13.6 qualifies — plus `pip install 'flet[all]'` and PyInstaller. **No Flutter SDK, no Visual Studio.** Zero new system-level installs.

**Path B — `flet build windows` (Flutter, folder output):** Flutter SDK (auto-downloaded on first build) **plus Visual Studio 2022/2026 with "Desktop development with C++"** ([publish/windows](https://flet.dev/docs/publish/windows/)), plus Developer Mode if any plugin is used.

### 6. Geist fidelity

**Custom fonts: yes**, via `page.fonts = {...}` + `page.theme = Theme(font_family=...)` ([fonts cookbook](https://flet.dev/docs/cookbook/fonts/)).

**Critical caveat, verbatim from that page: "Currently, only static fonts are supported."** Variable fonts are "in progress"; workaround is generating static instances with `fonttools`. Geist ships as variable, so pre-generate per-weight static `.ttf`s. Only `.ttf` is shown; `.otf` support `UNCONFIRMED`.

Theming surface is **Material**: `ft.Theme(color_scheme_seed=…, color_scheme=…)`, `visual_density`, and a Material type scale (DISPLAY/HEADLINE/TITLE/BODY/LABEL × LARGE/MEDIUM/SMALL) ([theming](https://flet.dev/docs/cookbook/theming/), [theme types](https://flet.dev/docs/types/theme/)) — not Geist's typography scale. You map by overriding `TextStyle` per control.

1px hairlines: `DataTable` exposes `horizontal_lines`, `vertical_lines`, `divider_thickness` ([datatable](https://flet.dev/docs/controls/datatable/)), but Flutter widths are logical pixels and `devicePixelRatio` "might not even be an integer" ([API](https://api.flutter.dev/flutter/widgets/MediaQueryData/devicePixelRatio.html)). At 125%/150% a `width=1` border rasterises to 1.25/1.5 physical px and antialiases. `UNCONFIRMED` whether Flet even surfaces `devicePixelRatio` to Python.

**No Geist or shadcn theme for Flet exists** — nothing in [awesome-flet](https://github.com/flet-dev/awesome-flet) or elsewhere.

**The structural limit: Flet does not expose arbitrary Flutter widgets from Python.** Its docs state "not all Flutter widgets or third-party packages can be directly supported by the Flet team or included in the core Flet framework"; the escape hatch is writing a **Flet extension** — a Python dataclass control **plus Dart code** (`src/<name>.dart`) plus `pubspec.yaml` — then **`flet build`** to compile it ([user-extensions](https://flet.dev/docs/extend/user-extensions/)).

**That couples §6 to §2 fatally: extensions require `flet build`, which produces a folder, while `flet pack` reuses the prebuilt desktop client. "One exe via `flet pack`" and "custom Flutter widgets" are mutually exclusive.** So `shadcn_flutter` (which ships Geist, §6.6) is unreachable from the one-exe path.

### 7. Animated GIF

**Supported.** "The following popular formats are supported: JPEG, PNG, SVG, **GIF, Animated GIF**, WebP, Animated WebP, BMP, and WBMP" ([Image control](https://flet.dev/docs/controls/image/)). `src` accepts a URL, local asset path, base64 string, or raw bytes; `gapless_playback` avoids flicker on provider change.

`UNCONFIRMED` at ~1,400 sprites — same Flutter `ImageCache` caveats as §6.7.

### 8. Virtualized data grid

**`ft.DataTable` is NOT virtualized.** It maps to Flutter's `DataTable`, whose docs say verbatim:

> "It's expensive to display large amounts of data with this widget, since it must be measured twice: once to negotiate each column's dimensions, and again when the table is laid out."
> "A `SingleChildScrollView` mounts and paints the entire child, even when only some of it is visible."
> — [DataTable class](https://api.flutter.dev/flutter/material/DataTable-class.html)

Field report: "Datatable freezes. flet 0.22" ([#3078](https://github.com/flet-dev/flet/issues/3078)).

**`ListView` IS virtualized** — `build_controls_on_demand`: "Whether the `controls` should be built lazily/on-demand, i.e. only when they are about to become visible. This is particularly useful when dealing with a large number of controls." Plus `cache_extent`, `item_extent`, `prototype_item` ([ListView](https://flet.dev/docs/controls/listview/)).

`flet-datatable2` exists as a built-in extension wrapping `data_table_2` ([docs](https://flet.dev/docs/controls/datatable2/)) — but the upstream package does not virtualize (§6.8), **and extensions require `flet build`, i.e. the folder path** (§6).

**Verdict: the only viable virtualized multi-column table in Flet is hand-rolled** — `ListView(build_controls_on_demand=True, item_extent=<fixed row height>)` where each item is a `Row` of `Container` cells, with a separately rendered sticky header and manually synchronised column widths. Every filter/sort then triggers a full control-tree diff serialized over the Flet protocol (msgpack in 1.0, JSON before — [1.0 alpha](https://flet.dev/blog/introducing-flet-1-0-alpha/)).

### 9. Stability and production users

| Date | Version | Note |
|---|---|---|
| 2025-06-26 | 0.70.0.dev | **Flet 1.0 Alpha** — "not just a feature release — it's a **ground-up rewrite** designed to address technical debt" ([blog](https://flet.dev/blog/introducing-flet-1-0-alpha/)) |
| 2025-12-24 | 0.80.0 | **Flet 1.0 Beta** — "not a drop-in upgrade — it includes breaking changes"; API "99% stable"; recommends pinning **0.28.3** if not upgrading ([blog](https://flet.dev/blog/flet-1-0-beta/)) |
| current | 0.86.5 | [PyPI](https://pypi.org/pypi/flet/json) |

Documented breaking changes in the 1.0 line: imperative → declarative React-like model; single-threaded async UI, control methods became async; auto page update; `ft.run()` renames and `Page` class split; dialog methods replaced by `page.show_dialog()`; `FilePicker` moved to services; charts and many controls moved to separate `flet-*` packages; binary msgpack replaces JSON. Open migration meta-issue: [#6172](https://github.com/flet-dev/flet/issues/6172). Older releases have been yanked from PyPI before ([#3014](https://github.com/flet-dev/flet/issues/3014)).

Other known issues: Windows packaged startup "does not load even after 10 seconds", closed with no visible resolution ([#3736](https://github.com/flet-dev/flet/issues/3736)); Android APK cold start 10–13 s before first render, indicative of the embedded-Python startup profile ([#6644](https://github.com/flet-dev/flet/issues/6644)); macOS packaged startup slowness ([#1632](https://github.com/flet-dev/flet/issues/1632)); `flet build windows` stuck at "packaging python app" ([#5507](https://github.com/flet-dev/flet/issues/5507)).

**Production users: `UNCONFIRMED`.** No named commercial or enterprise Flet deployment could be verified from a primary source; Flet has no showcase page listing production users. The only first-party non-trivial app is **Flet Studio**, built by the Flet team itself ([blog](https://flet.dev/blog/2026-05-28-flet-studio/)). Community lists are hobby/demo grade. A community thread explicitly asks for "Production grade full fledged flet examples" ([#5394](https://github.com/flet-dev/flet/discussions/5394)) — itself evidence the answer is not obvious.

---

## 8. The webview question: does a big in-binary payload penalise startup vs a sidecar directory?

**Short answer: for Tauri, no — the penalty is per-asset Brotli decode, which you can turn off. For Electron, yes and severely — but the penalty comes from the portable-exe wrapper, not from asar.**

R3 forbids a sidecar folder, so this decides between the two webview options.

### Tauri

Frontend assets compile into the binary as a `HashMap<String, EmbeddedAsset>`, Brotli-compressed at build time, SHA-256 hashed ([codegen](https://deepwiki.com/tauri-apps/tauri/7.5-code-generation-and-build-scripts)). At runtime WebView2 requests `http://tauri.localhost/<path>`; wry intercepts via WebView2's `AddWebResourceRequestedFilter` pipeline and `AssetResolver` returns the bytes ([AssetResolver](https://docs.rs/tauri/latest/tauri/struct.AssetResolver.html), [custom protocol handlers](https://deepwiki.com/tauri-apps/tauri/4.4-custom-protocol-handlers)).

**There is no bulk extraction and no I/O of the full payload at launch.** The static bytes live in a `.rdata` section of the exe and are demand-paged by the Windows loader (§0.4).

The per-request Brotli decode is acknowledged and removable ([#8894](https://github.com/tauri-apps/tauri/issues/8894), open; disable via `default-features = false`, [app-size](https://v1.tauri.app/v1/guides/building/app-size/)). Since ticket 02 measured GIFs compress ~2%, **turning compression off is essentially free size-wise and strictly faster**.

Known custom-protocol throughput problems exist but are **Linux/WebKitGTK, not Windows**: issue #4197 measured ~1.3 MB/s for a 148 MB GIF (194,987 ms, one core pegged at 100%) vs <2 s in NW.js, on OracleLinux + Ryzen 7 5800U ([#4197](https://github.com/tauri-apps/tauri/issues/4197)). **Do not transfer that figure to WebView2 — `UNCONFIRMED` for Windows.** Related: asset-protocol memory not released ([#2952](https://github.com/tauri-apps/tauri/issues/2952)), crashes seeking in large videos ([#6375](https://github.com/tauri-apps/tauri/issues/6375)), and WebView2 not supporting streaming/range for custom protocols ([discussion #5690](https://github.com/orgs/tauri-apps/discussions/5690)) — meaning the whole response body is buffered per request. Fine for 84 KB sprites; fatal for GB-scale video. PokeStats is the former.

**The bigger Tauri risk is build-side, not startup-side:** compiler RAM (§1.4) and the open large-asset build failure ([#12403](https://github.com/tauri-apps/tauri/issues/12403)).

### Electron

**asar itself is nearly free** — uncompressed concatenation with an index, reads are `fs` calls at an offset. The only latency source is the documented temp-extraction path for `fs.open` / `execFile` / `dlopen` ([asar-archives](https://www.electronjs.org/docs/latest/tutorial/asar-archives)). Avoid those APIs and asar performs like a sidecar directory.

**The `portable` target's temp extraction dominates.** The existence of `splashImage` — "the image to show while the portable executable is extracting" — is source-level proof of a visible extraction phase ([nsisOptions.ts](https://github.com/electron-userland/electron-builder/blob/master/packages/app-builder-lib/src/targets/win/nsis/nsisOptions.ts)). ~10 s reported for a *hello-world* portable build ([#5765](https://github.com/electron-userland/electron-builder/issues/5765)). With ~400 MB of LZMA-compressed payload this scales with decompression throughput, not app complexity — and §0.3 puts the disk write alone at 2.8 s for 155 MB on this machine.

**Nuance on repeat launches:** `unpackDirName` defaults to a build UUID, stable for a given exe, so the extracted directory *should* persist across launches. Setting it to `false` forces a unique `$PLUGINSDIR` per launch. Contradicting field reports of re-extraction every run exist ([#8739](https://github.com/electron-userland/electron-builder/issues/8739)). **`UNCONFIRMED` and worth measuring** — it is the difference between a one-time first-run cost and a per-launch tax.

### The asymmetry, stated plainly

| | Startup penalty from embedding the payload | vs sidecar directory |
|---|---|---|
| **Tauri, `target/release` exe** | Lazy per-asset decode on first request; **no bulk extraction, no full-payload I/O at launch**. Removable entirely by disabling `compression`. | Near-parity. A sidecar avoids decompression but requires the `resources` mechanism, which the portable path forbids. |
| **Electron, `portable` target** | **Bulk LZMA extraction of the whole payload to `%TEMP%` before the app process starts.** ~10 s for hello-world; ≥2.8 s of raw disk write for our payload on this box. | A sidecar or normal installed folder eliminates it entirely. asar contributes ~nothing; the portable wrapper contributes everything. |

If "one portable exe" and "fast cold start" are both hard, that combination is exactly where Electron loses — **unless** measurement confirms the build-UUID temp dir is reused from launch 2 onward, reducing the penalty to a one-time first-run cost.

---

## 9. Comparison table

Sizes assume the realistic 155 MB sprite payload (§0.1), not the 400 MB ceiling.

| Stack | Single-file exe size | Cold start | Runtime-free? | Geist fidelity | Animated GIF | Virtualized grid | Toolchain to install |
|---|---|---|---|---|---|---|---|
| **Tauri v2** | ~165–175 MB projected (8.6 MiB shell measured, N=1 macOS) · `UNCONFIRMED` at payload | `UNCONFIRMED` — no credible Windows benchmark exists. No bulk extraction; assets demand-paged | **Yes on Win11** — WebView2 ships with the OS (MS docs); verified 151.0.4129.93 on this box. `+crt-static` removes the VC++ dep. No offline repair possible from one exe | **1:1** — Chromium, Tailwind + shadcn/ui, Geist woff2 **with variable axes**, SIL OFL | **Native** | **TanStack Virtual/Table MIT · AG Grid Community MIT, row+column virt. by default** | **Rust + MSVC "Desktop development with C++"** (multi-GB, neither installed) |
| **Electron** | ~400 MB projected (244 MiB minimal demo measured) | **~10 s reported for hello-world portable**; extraction dominates. ≥2.8 s of raw disk write measured here for 155 MB | **Yes, absolutely** — pinned Chromium + Node inside, no OS dependency at all | **1:1, and pinned** — no evergreen drift; variable axes | **Native** | Same as Tauri (MIT) | **None — Node 22.18.0 already present** |
| **.NET 9 WPF** | **~305 MB** (~150 MB framework floor measured + 155 MB assets). No trimming (`NETSDK1168`), no AOT, R2R broken | **2–3 s cold measured** (Ryzen 7 5800H, .NET 6, R2R); 250–300 ms warm. Closed as not planned. `UNCONFIRMED` here | **Yes — cleanest genuine one-file of the .NET options.** Only small native runtime DLLs extract to `%TEMP%\.net`; the 155 MB stays memory-mapped | **Close, not 1:1.** No variable axes (#7813); ClearType ≠ browser AA; `UseLayoutRounding`/`SnapsToDevicePixels` both default **false**; 1px = 1.25/1.5 px at 125/150%. **No Geist or shadcn XAML kit exists** — write it from scratch | **Not native.** XamlAnimatedGif (Apache-2.0, active 2026-06-25, JIT frame decode) is the only viable lib | **`DataGrid`, mature, free.** Row virt. default **on**, column virt. default **off** | **.NET SDK only** (~213 MB, `UNCONFIRMED`). No VS, no MSVC |
| **.NET 9 WinUI 3** | ~230 MB folder measured + 155 MB assets ≈ 385 MB. AOT available (−2x self-contained per MS) | `UNCONFIRMED`, no absolute figures published. **~385 MB extracts to `%TEMP%\.net` on first launch** (~7 s of I/O on this box) | **Fragile.** Two current MS docs contradict each other; supported path is a self-extracting archive; **launch bug open since Nov 2024** (#10173) | Same gaps as WPF, but `UseLayoutRounding` defaults **true**. Fonts must be loose files (`ms-appx:` only) — the same path #10173 breaks. **No Geist/shadcn kit** | **Native** — `BitmapImage.IsAnimatedBitmap`/`AutoPlay`/`Play`/`Stop` | **None.** Toolkit `DataGrid` frozen at 7.1.2 (2021-11-18), absent from active 8.x. Fall back to `ItemsRepeater` + hand-built grid, or Syncfusion | **VS 2022/2026 + WinUI workload + Developer Mode + MSIX tooling** (+ MSVC if AOT) |
| **Avalonia 12** | ~175–235 MB projected (60 MB DiskDigger real app measured + assets) | `UNCONFIRMED` on Windows (the 4x AOT figure is **Android**). Native libs self-extract to `%TEMP%\.net` on first run | Yes for .NET, but VC++ 2015 redist for Skia, and **DX12 dependency in v12** (closed by-design). True static single-file only via a **third-party Skia/ANGLE fork** | **Weakest hairline story** — 1px invisible at 125% (#8867), plus #7798/#5709/#18511. **No variable fonts** (#11092). No WOFF2. **No Geist port**; ShadUI (MIT, 535★) is the closest start | **Not native.** `Avalonia.Labs.Gif` MIT 12.0.2 (2026-04-23), official-org; known decode defect | **In flux.** `DataGrid` **deprecated**; `TreeDataGrid` **archived + commercialised**; **`TableView`** (core, 12.1, rows virt.+recycled, **columns not**) is the replacement and fits read-only tabular data | **.NET SDK** (+ MSVC if AOT) |
| **Flutter desktop** | **N/A — no single exe exists** | `UNCONFIRMED` | **No.** Folder + `flutter_windows.dll` + `data/` + VC++ DLLs | Best non-web option: **variable fonts supported**, `shadcn_ui` (MIT) and `shadcn_flutter` (BSD-3, **ships Geist**) exist. But **no ClearType** — AA will not match a browser | **Native**, with documented OOM/jank caveats at scale | `data_table_2` no virt.; `pluto_grid` `UNCONFIRMED`; Syncfusion commercial | **Flutter SDK (1.5 GB) + VS 2022 Desktop C++** — heaviest of all |
| **Python + Flet** (V1 baseline) | ~78 MB `flet pack` measured + 155 MB assets ≈ 235 MB | **Worst.** PyInstaller onefile extracts everything to `%TEMP%` **every launch, no caching** (3 open FRs). **2,801 ms of disk write measured on this machine, AV off**, before Python starts | Python not required; VC++ DLLs bundled. **But 0.25.1 shipped a regression that phoned home on startup** (#4549) — a live R2 violation | **Material, not Geist.** **Static fonts only** — "Currently, only static fonts are supported". No Geist/shadcn theme. **Cannot use arbitrary Flutter widgets from the one-exe path** — extensions require `flet build` (folder) | **Native** | **None.** `DataTable` is not virtualized (Flutter docs: "expensive… must be measured twice"). Must hand-roll `ListView(build_controls_on_demand=True)` | **None for `flet pack`** — Python 3.13.6 present. (`flet build` would need Flutter SDK + VS C++) |

---

## Shortlist

Three survive. Two of the three are the same architecture, which is itself the finding.

### 1. Tauri v2 — the only stack that satisfies every hard constraint at once

One genuine portable exe on Win11 (WebView2 is an OS component, verified present here). 155 MB of sprites embedded in a demand-paged data section, costing ~0 ms at launch. Geist reproduced exactly, variable axes included, via shadcn/ui + Tailwind. Native GIF. The best free virtualized grid in the document. **Cost: installing Rust + MSVC Build Tools, and validating [#12403](https://github.com/tauri-apps/tauri/issues/12403) at 155–310 MB.**

### 2. Electron — same UI ceiling, zero toolchain cost, one open question

Identical Geist fidelity (better, actually — pinned Chromium), identical grid options, and **nothing to install**: Node 22.18.0 is already here. It survives only if measurement shows the portable target's temp dir is reused from launch 2 onward. If it re-extracts every launch, it is eliminated by the same fact that eliminates Flet.

### 3. .NET 9 WPF — the non-web fallback, and the only credible one

If installing Rust is unacceptable and Electron's extraction proves per-launch, WPF is the answer: a genuinely runtime-free single exe where the 155 MB stays memory-mapped, a mature free virtualized `DataGrid`, and the lightest new toolchain of any non-web option (.NET SDK, no VS, no MSVC). **You pay for it in Geist fidelity** — no variable axes, ClearType instead of browser AA, hairlines that shift between 1 and 2 px at 125/150%, and a Geist theme written from scratch in XAML with no existing kit to start from.

### The single decisive fact that eliminated each of the others

| Eliminated | The one fact |
|---|---|
| **Python + Flet** | PyInstaller `--onefile` **extracts the entire payload to `%TEMP%` on every launch with no caching** ([docs](https://pyinstaller.org/en/stable/operating-mode.html); three open FRs asking for caching). Measured on this machine: **2,801 ms of disk write for 155 MB, with AV off, before Python starts** — over 2x the entire R5 tab budget, every launch. |
| **Flutter desktop** | **Single-exe support was closed as *not planned*** ([#105655](https://github.com/flutter/flutter/issues/105655)) with an engine-level blocker ([#57875](https://github.com/flutter/flutter/issues/57875)), and assets are a `data/flutter_assets/` folder by design. R3 is unmet by the platform, not by configuration. |
| **WinUI 3** | The supported single-exe path **requires `IncludeAllContentForSelfExtract`** (self-extracting, not a real single binary), **Microsoft's own two current docs contradict each other** on whether it even works, and the bug that breaks it — loading `Microsoft.WindowsAppRuntime.dll` from the wrong directory — is **open and unfixed since 2024-11-16** ([#10173](https://github.com/microsoft/microsoft-ui-xaml/issues/10173)). Compounded by having **no maintained data grid** (Toolkit `DataGrid` last shipped 2021-11-18, absent from the active 8.x line). |
| **Avalonia** | **1px borders are invisible at 125% DPI** ([#8867](https://github.com/AvaloniaUI/Avalonia/issues/8867), with #7798/#5709/#18511 alongside) — for a design language whose entire visual identity is 1px hairline borders and dense tables, that is the requirement, not a detail. Compounded by no variable fonts ([#11092](https://github.com/AvaloniaUI/Avalonia/issues/11092)) and a grid story in mid-migration (DataGrid deprecated, TreeDataGrid archived and commercialised). |

### The two measurements to run before ticket 06 decides

Both are cheap and both are load-bearing:

1. **Electron portable temp-dir reuse.** Build a portable exe with a ~155 MB dummy payload; diff `Get-ChildItem $env:TEMP` across five launches; repeat with `unpackDirName` default, `"pokestats"`, and `false`. This single number decides whether Electron (zero toolchain cost) beats Tauri (Rust + MSVC install).
2. **Tauri build at real payload size.** Put the 1,686 real GIFs in an `include_dir` crate, build release with `compression` disabled, and confirm it does not hit [#12403](https://github.com/tauri-apps/tauri/issues/12403). Record exe size, compile time and peak compiler RAM.

And when either is instrumented: **do not build the cold-start harness on `Process.MainWindowHandle`.** Tested on this machine against `notepad.exe`, it returned `gotWindow=0` on every run because the window belongs to another process — which is true of every multi-process webview stack. Instrument the app itself and emit a first-paint timestamp.
