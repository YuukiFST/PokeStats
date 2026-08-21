# Vercel Labs `native` (Native SDK) — evaluation for a Windows-only Pokémon stats desktop app

Researched 2026-08-21. All facts below are sourced; nothing is answered from memory.

## Verdict

1. Native SDK is a Zig-implemented, non-web GUI toolkit: you author views in a closed `.native` markup grammar plus a TypeScript "core", and its own engine rasterizes every pixel into real OS windows — no browser, no WebView, no JS runtime in the shipped binary.
2. It cannot build this app on Windows today.
3. Decisive fact: the runtime's registered-image registry is a hard-coded **16 slots** at a maximum **8 MiB of decoded pixels each** ([`src/runtime/canvas_limits.zig:109-118`](https://github.com/vercel-labs/native/blob/main/src/runtime/canvas_limits.zig)), the SDK **bundles no image codecs at all**, and there are **zero occurrences of "gif" anywhere in the repository** — so ~1,700 animated GIF sprites is not a tuning problem, it is outside the runtime's model. Second decisive fact: `native package --target windows` emits a **directory**, not a single `.exe` — "Windows packaging is in early development" ([docs/packaging](https://native-sdk.dev/docs/packaging)).

---

## 1. What is it, precisely?

**Stated purpose.** "Native SDK is an open source toolkit for building beautiful native desktop applications. It combines markup for declarative interfaces, a predictable message-based state model, a modern component library, a native renderer, and tooling for building, running, and packaging apps — one codebase for macOS, Linux, and Windows, with experimental iOS and Android support riding the same runtime." ([docs/introduction](https://native-sdk.dev/docs/introduction))

**The problem it claims to solve.** "It exists because expressive UI and native performance should not be competing goals. Developers often choose web-based runtimes because they offer freedom, speed and control over the product experience. But that freedom often comes with a heavy runtime. Native SDK keeps the expressive authoring model and replaces the runtime with native rendering." ([docs/introduction](https://native-sdk.dev/docs/introduction))

**What it is NOT.** Not React Native, not a webview, not Electron/Tauri. It is a **custom renderer driving a custom markup language**. From the README: "Views are declarative markup in `.native` files, logic is plain TypeScript compiled to native code at build time — or Zig, first-class by choice — and Native SDK's own engine draws every pixel into real OS windows. No browser, no WebView, no JS runtime in the binary: Zig is how everything works, TypeScript and Native markup are how apps are authored." ([README](https://github.com/vercel-labs/native/blob/main/README.md))

**The programming model** is Elm architecture, not React. A `Model` interface, a `Msg` union, and one pure `update(model, msg)` function; markup "can bind and dispatch but never mutate". ([README](https://github.com/vercel-labs/native/blob/main/README.md))

**Language reality.** The repo's primary language is Zig ([GitHub API](https://github.com/vercel-labs/native)). TypeScript is compiled ahead of time by a third-party compiler called `scriptc` (an npm dependency of the CLI, currently `scriptc@0.0.33` — [`npm view @native-sdk/cli dependencies`](https://www.npmjs.com/package/@native-sdk/cli)). Your TypeScript is not run by V8 or QuickJS; it is compiled to a static library. The published TS API surface (`@native-sdk/core@0.9.5`) is **effects and message plumbing only** — `Cmd.imageLoad`, `Cmd.fetch`, PTY, SQLite, audio — with **no view-building, no token, and no layout API**. Views for TypeScript apps must be markup. (Verified by unpacking `@native-sdk/core@0.9.5`: `package/sdk/core.d.ts`, `package/sdk/events.d.ts`.)

**Build prerequisites** on the developer machine: Node.js 24+ and Zig 0.16.0 (the CLI offers to download the pinned Zig into `~/.native/toolchains/`). ([docs/quick-start](https://native-sdk.dev/docs/quick-start))

---

## 2. Maturity and status

Everything below is from the GitHub API on 2026-08-21 unless noted.

| Fact | Value |
|---|---|
| Stars | 7,537 |
| Forks | 302 |
| Repo created | 2026-05-08 |
| Earliest commit on `main` | 2026-05-13 ("Prepare 0.2.0 release") |
| Last push | 2026-08-19 |
| Archived / disabled | No / No |
| License | Apache-2.0 |
| Open issues (non-PR) | **74** |
| Closed issues | **28** |
| Open pull requests | **67** |
| Latest release | **v0.9.5**, 2026-08-18 |
| Release cadence | 29 npm versions; roughly 2 releases per week since v0.2.0 |

Source: [`gh api repos/vercel-labs/native`](https://github.com/vercel-labs/native), [releases](https://github.com/vercel-labs/native/releases), [issue search](https://github.com/vercel-labs/native/issues).

**npm packages.**

- `@native-sdk/cli` — latest **0.9.5**, published **2026-08-18**, unpacked size **34.7 MB**, 29 versions, first published 2026-07-08. Sole npm maintainer: `ctate <chris@ctate.dev>`. ([npm](https://www.npmjs.com/package/@native-sdk/cli))
- `@native-sdk/core` — latest **0.9.5**, published 2026-08-18, first published 2026-07-11. ([npm](https://www.npmjs.com/package/@native-sdk/core))
- Platform binaries ship as optional deps: `@native-sdk/cli-{darwin-arm64,darwin-x64,linux-{arm64,x64}-{gnu,musl},win32-arm64,win32-x64}` — **a `win32-x64` build exists**. ([`npm view @native-sdk/cli optionalDependencies`](https://www.npmjs.com/package/@native-sdk/cli))
- The unrelated npm package literally named `native-sdk` (v1.0.0, 2024) is **not** this project.

**Stability guarantee: none, explicitly.** README: "Native SDK is pre-1.0: APIs still move, and the toolkit is evolving quickly." ([README](https://github.com/vercel-labs/native/blob/main/README.md)) The project was renamed mid-flight: the CHANGELOG header reads "All notable changes to the Native SDK (**formerly zero-native**)". ([CHANGELOG.md](https://github.com/vercel-labs/native/blob/main/CHANGELOG.md)) Breaking changes land in minor releases — v0.9.5 changed the default manifest format from `app.zon` to `app.json` (#385).

**Commit cadence, last 3 months.** Weekly commit counts from the GitHub participation endpoint: 64, 0, 0, 0, 0, 157, 21, 6, 24, 24, 30, 24, 41, 33 — i.e. **active every week for the last ~9 weeks**, most recent full week 33 commits. Not abandoned as of 2026-08-19.

**But the bus factor is 1.** Contributor breakdown: `ctate` **419 commits**; `Railly` 3; `Anshuman71` 1; `PrathamGhaywat` 1. ([contributors](https://github.com/vercel-labs/native/graphs/contributors)) One person has written essentially the entire toolkit and is also the sole npm publisher. The 67-open-PR backlog against 28 closed issues is the visible consequence: contributions arrive faster than one maintainer absorbs them.

Labelled experimental or alpha? Not in those words for desktop — the docs reserve `Experimental` for iOS and Android, and present desktop as the mature surface. The honest label is **pre-1.0, single-maintainer, three months old**.

---

## 3. Platform support

Windows is targeted and is a real host — but it is the **third** platform, behind macOS and Linux.

README, verbatim: "macOS is the primary development platform and carries the deepest support: Metal presentation, OS scroll physics, native context menus, app menus, tray, and dialogs. Linux runs the full showcase through the deterministic software renderer in real windows... **Windows runs on a Win32 host** with native context menus and IME composition and is exercised in CI, including real input injection." ([README](https://github.com/vercel-labs/native/blob/main/README.md))

From the [platform support matrix](https://native-sdk.dev/docs/platform-support), the Windows column:

| Capability | Windows |
|---|---|
| Real OS windows | Full |
| Native rendering | **Caveats** — "deterministic software renderer, GDI blit; per-monitor DPI aware" |
| Text / registered fonts | Full (software renderer inks; DirectWrite resolves packet text) |
| Pointer / keyboard / IME | **Caveats** — "IME composition is mapped; real-hardware IME verification is pending" |
| Menus (app + context) | Full — `TrackPopupMenu` |
| System tray | Full |
| System notifications | **Caveats** — legacy `Shell_NotifyIcon` balloon, one in flight, no custom button |
| Web content (WebView) | **Caveats** — WebView2 only; bundled Chromium (CEF) is **macOS-only** |
| **Packaging** | **Caveats** — "directory artifact with icons and file-type registration; installer is future work" |
| **Code signing** | **None** — "No signing tooling exists yet for the other platforms" |
| Automation | Full |
| Video decoding | **Not implemented** — "Hosts without a decoder yet (Windows and Linux today) report the capability honestly and answer a load with one explicit `failed` event" ([docs/components/video](https://native-sdk.dev/docs/components/video)) |

iOS and Android are marked `Experimental` throughout.

**The Windows renderer story is internally inconsistent in the docs.** Footnote 2 of the matrix says: "Windows presents representable retained packets through **Direct2D/DirectWrite** and falls back to the deterministic software renderer for unsupported commands, transparent layered windows, or unavailable GPU resources." The matrix cell for the same row says "deterministic software renderer, GDI blit". Both statements sit on the same page. Practical reading: Windows gets partial GPU acceleration with a CPU fallback, and which path you land on depends on what your UI draws. `UNCONFIRMED` which path a table-heavy dark UI actually takes.

**Windows CI exists but is thin.** `.github/workflows/ci.yml` has one `windows-2022` job (`windows-webview`) running WebView link tests, a no-console effects probe, and a registered-font receipt. The job named `windows-web-layer-audit` runs on `ubuntu-latest`. The example-app matrix (`Native Examples`, four shards) runs on `ubuntu-latest` only. ([ci.yml](https://github.com/vercel-labs/native/blob/main/.github/workflows/ci.yml))

**And the Windows quickstart is broken right now.** Issue [#365](https://github.com/vercel-labs/native/issues/365), "native build failed on windows 11 with nodejs v24.18.0", opened 2026-08-16, **still open**: a freshly scaffolded `native init my_app && native dev` fails inside the `scriptc` clang backend. A commenter reproduced the same failure on Ubuntu 24.04 on 2026-08-17. Other open Windows issues: [#261](https://github.com/vercel-labs/native/issues/261) (`restore_state` ignored by the WebView2 host), [#53](https://github.com/vercel-labs/native/issues/53) (Windows 11 build failure, open since 2026-05-20), [#7](https://github.com/vercel-labs/native/issues/7) (Windows bridge ABI mismatch, open since 2026-05-09, zero comments), [#13](https://github.com/vercel-labs/native/issues/13) (CEF missing for Linux/Windows).

---

## 4. Packaging — the single `.exe` requirement

**No. It does not produce a single self-contained `.exe`, and it does not embed your assets.**

The pipeline is two commands:

```bash
native build      # -> zig-out/bin/<name>[.exe]
native package --target windows --manifest app.json --binary zig-out/bin/MyApp.exe
```

([docs/packaging](https://native-sdk.dev/docs/packaging))

What `native package --target windows` produces, verbatim: "**Windows packaging is in early development.** The packager copies the binary and assets into a **distributable directory structure** and writes a multi-size `app-icon.ico` generated from your icon source... When file associations or URL schemes are configured, the artifact also includes `install/register-file-types.ps1`, which registers the package-local executable under the current user's `HKCU\Software\Classes` registry keys." ([docs/packaging](https://native-sdk.dev/docs/packaging))

On assets: "A native-rendered app packages as **a single binary plus icons, metadata, and whatever lives in your `assets/` directory**... **Keep large optional data out of `assets/` when you package, or it ships.**" On macOS the tree is mirrored into `Contents/Resources/assets/`. There is no "embed assets into the executable" step anywhere in the packaging pipeline. ([docs/packaging](https://native-sdk.dev/docs/packaging))

So the shipped artifact for this app would be `MyApp.exe` next to a 155 MB `assets/` folder — exactly the shape the requirement rules out.

**Escape hatch, partial.** A Zig-core app can `@embedFile` arbitrary bytes into the executable; the docs demonstrate exactly that for fonts (`.ttf = @embedFile("fonts/NotoSansSC-Regular.ttf")` — [docs/fonts](https://native-sdk.dev/docs/fonts)). Embedding 155 MB of bytes is therefore mechanically possible **if you write your core in Zig**, giving up the TypeScript authoring path. But those bytes still have to become *registered images* to render, and §5 shows that door is shut. For a TypeScript-core app, launch-registered images are declared as **file paths** in the manifest (`.assets.images = .{ .id = 1, .path = "assets/art/cover.jpg" }` — [docs/app-zon](https://native-sdk.dev/docs/app-zon)), so the TypeScript path cannot embed at all.

**Runtime on the user machine:** genuinely none for a native-rendered app — "no browser runtime", no JS runtime. The WebView2 dependency applies only if you embed web content ([docs/platform-support](https://native-sdk.dev/docs/platform-support) footnote 7).

**Realistic binary size:** the only figure the project publishes is for the scaffold — "the scaffolded counter app builds to **a single binary a few megabytes small**" ([README](https://github.com/vercel-labs/native/blob/main/README.md)). No figure exists for a real application. `UNCONFIRMED` what this project's binary would weigh.

**Cross-compilation to or from Windows:** the documented `-Dplatform` build option accepts `auto`, `null`, `macos`, `linux` — **`windows` is not listed** ([docs/packaging](https://native-sdk.dev/docs/packaging), Build options table), even though `native package --target windows` and CI's `zig build test-webview-system-link -Dplatform=windows` both use it. The docs table is stale. `UNCONFIRMED` whether cross-targeting Windows from another host works.

**Code signing on Windows: none.** SmartScreen will flag an unsigned portable binary — true of any unsigned exe, but note the SDK offers tooling for macOS and none here. ([docs/platform-support](https://native-sdk.dev/docs/platform-support) footnote 9)

---

## 5. Rendering and performance

**How it draws.** Its own CPU reference renderer is the shared ground truth on every platform ("goldens, screenshots, and software presents all ink through it"), with platform acceleration layered on where available: Metal on macOS, Direct2D/DirectWrite on Windows for "representable retained packets", software plus cairo on Linux. Not Skia, not native OS controls, not a webview. Scroll physics, menus, dialogs, tray and text input are delegated to the OS. ([docs/platform-support](https://native-sdk.dev/docs/platform-support), [README](https://github.com/vercel-labs/native/blob/main/README.md))

**Cold start.** No JS runtime, no browser, and markup compiled into the executable at build time — "a release build carries no parser or interpreter" ([README](https://github.com/vercel-labs/native/blob/main/README.md)). Architecturally this is the best-case profile for cold start. No published benchmark numbers exist. `UNCONFIRMED`.

**Virtualized table with tens of thousands of cells — this is a real problem.**

There are two mechanisms and neither gives the app what it needs from the TypeScript path:

1. **`virtual-list`** — genuinely windowed; the model owns the data and the tree holds only the visible window. `examples/feed` demonstrates a 100,000-row list. But the docs state plainly: "The windowed virtual list is **builder-only**: the closed markup grammar has no channel for the view to receive the runtime's range request inside a `for` binding, so markup cannot build 'only the visible rows' honestly." The only code sample is Zig, and `examples/feed` contains exactly `app.zon`, `src/main.zig`, `src/tests.zig` — **Zig only**, with no TypeScript equivalent anywhere in `examples/`. ([docs/components/virtual-list](https://native-sdk.dev/docs/components/virtual-list))
2. **`<list virtualized>`** — the markup-expressible form, and it is bounded layout only: "The rows still all **BUILD** (this bounds layout and paint, not the tree), so it suits row sets the model already holds — **hundreds, not hundreds of thousands**." ([docs/components/list](https://native-sdk.dev/docs/components/list))

Critically: **the `table` component has no virtualization at all.** It is `table` > `table-row` > `table-cell` with flex column sizing and engine-owned hairline separators, driven by a plain `<for each>`. The virtualization attributes belong to `list`, not `table`. ([docs/components/table](https://native-sdk.dev/docs/components/table)) `list-item` does accept element children for composite rows, so a virtualized multi-column list is expressible — but you lose `table`'s cross-row column alignment and rebuild it by hand with `grow` factors.

Net: a 1,400-row dex sits at the top of what `<list virtualized>` is documented to handle, and a true virtualized *table* means either writing the view in Zig (abandoning the TypeScript core, the entire ergonomic selling point) or hand-rolling columns out of `list-item` children.

**~1,700 animated GIFs — this is the wall.**

- **No codecs ship.** "Native SDK bundles no image codecs — encoded bytes (PNG, JPEG, whatever the OS decodes) go through the platform decoder: CGImageSource on macOS..., gdk-pixbuf on GTK, **WIC on Windows**." ([docs/native-ui](https://native-sdk.dev/docs/native-ui))
- **No GIF anywhere.** Searching all 1,731 files in the repository tree for "gif" (case-insensitive) returns **zero matches**. The only decoder in-tree is `src/primitives/canvas/png.zig`.
- **No animated-image API.** The image APIs are `registerImage(id, w, h, rgba8)`, `registerImageBytes(id, bytes)`, `unregisterImage(id)` — all single-frame. `Cmd.imageLoad` returns one result Msg carrying one width and height. There is no frame sequence, no playback, no per-frame timing anywhere in `@native-sdk/core@0.9.5`'s type surface. The only raster-video path is `media-surface`/`video`, whose producers are "Zig-tier toolkit extensions in this release" and whose **Windows decoder does not exist**. ([docs/components/media-surface](https://native-sdk.dev/docs/components/media-surface), [docs/components/video](https://native-sdk.dev/docs/components/video))
- **The registry is 16 slots.** Hard-coded: `pub const max_registered_canvas_images: usize = 16;`, `max_registered_canvas_image_pixel_bytes = 1 MiB` (default), `..._ceiling = 8 MiB`. ([`src/runtime/canvas_limits.zig:109-118`](https://github.com/vercel-labs/native/blob/main/src/runtime/canvas_limits.zig)) The docs restate it: "Capacities are fixed and loud (`canvas_limits`): **16 slots** with a 1 MiB decoded-pixel target by default... up to 8 MiB; ... filling all 16 ceiling-sized slots is a declared **128 MiB high-water**." ([docs/native-ui](https://native-sdk.dev/docs/native-ui))

Do the arithmetic against the requirement. 16 slots × 8 MiB ÷ 4 bytes/px = **33.5 M pixels of registered image, total, for the entire app**. 1,700 sprites at a modest 96×96 is 15.7 M pixels for **one frame each** — half the entire registry, before any animation. A typical animated showdown-style sprite is 20-60 frames; the honest requirement is 300 M-900 M pixels. That is roughly an order of magnitude past the ceiling.

Texture atlasing is supported and is the obvious mitigation — v0.9.5 added "Registered-image source cropping... for texture-atlas rendering" (#390, [CHANGELOG](https://github.com/vercel-labs/native/blob/main/CHANGELOG.md); `image_src` rect in [docs/native-ui](https://native-sdk.dev/docs/native-ui)). Atlasing gets *static* first frames of all 1,700 sprites into roughly 8 slots. It does not get you animation, because there is no clock-driven frame-advance primitive for images and no GIF decoder to produce the frames in the first place.

The only conceivable path is: decode GIF frames yourself in Zig, then re-register the visible sprite's pixels every ~50 ms via `registerImage`. The docs warn what that costs: "Re-registering an id replaces its pixels and **every view repaints**." Feasible for one hero sprite, not for a grid of them. That is a research project, not an implementation detail.

---

## 6. Styling model — and this part is genuinely good

**There is no CSS. At all.** Styling is a Zig struct of design tokens: "Every visual decision a built-in component makes — colors, radii, control heights, state washes, focus geometry, type sizes — reads from one `DesignTokens` value. There are **no per-component style props** and no emitter-level special cases." ([docs/theming](https://native-sdk.dev/docs/theming))

Markup colors are **token names only, never raw values**: "values are `ColorTokens` field names: `background`, `surface`, ..., `border`, `accent`, ..., `focus_ring`...". Radius takes a `RadiusTokens` name (`sm`/`md`/`lg`/`xl`). Numeric font sizes are refused by design — "retheme the typography tokens to move the whole scale". ([docs/native-ui](https://native-sdk.dev/docs/native-ui))

**Tailwind: no. shadcn/ui: no.** Neither is applicable — there is no DOM, no class attribute, no CSS engine, and React components cannot mount. This is a from-scratch component library with its own catalog of roughly 45 components (`button`, `tabs`, `table`, `combobox`, `chart`, `virtual-list`, `tree`, ...).

**There IS an official Geist theme, and it is faithful.** Two packs ship: `house` (default) and **`geist`** — "the design register of the bundled Geist typeface family: a cool neutral scale over pure white/black pages, monochrome primaries, blue focus rings, 6px control corners, and a taller 32/40/48 control ladder." ([docs/theming](https://native-sdk.dev/docs/theming)) Selected with one manifest line (`"theme": "geist"`) or at runtime from TypeScript via `themeState(model)` returning `{ pack: "geist", colorScheme: "dark" }` (`ThemeStatePack = "house" | "geist"` in `@native-sdk/core@0.9.5`'s `events.d.ts`).

**Geist Sans and Geist Mono are bundled in the engine**: `src/primitives/canvas/fonts/Geist-Regular.ttf` and `GeistMono-Regular.ttf`; "The SDK bundles two faces — Geist Regular and Geist Mono — and every built-in component renders through them by default." ([docs/fonts](https://native-sdk.dev/docs/fonts))

Requirements checked one by one against [`src/primitives/canvas/themes/geist.zig`](https://github.com/vercel-labs/native/blob/main/src/primitives/canvas/themes/geist.zig):

| Requirement | Status |
|---|---|
| Dark theme | Yes — the pack covers light, dark and both high-contrast variants; follows the OS or can be forced |
| **40px table rows** | **Exact match** — `.metrics = .{ .control_height_sm = 32, .control_height = 40, .control_height_lg = 48 }` (geist.zig:77-80). The separate default `row_extent` in `tokens.zig:558` is 28 and is independently overridable |
| **1px hairline borders** | Yes — `.stroke = .{ .hairline = 1, .regular = 1, .focus = 2, .focus_offset = 2 }` (geist.zig:56), with `.pixel_snap = .{ .geometry = true }` set explicitly so "geometry pixel snapping lands hairline borders on whole device columns" |
| **`#2e2e2e` hairline** | Effectively yes, expressed the way Geist itself expresses it: the dark pack's hairline is "white at 14%" (geist.zig:233), the alpha-token form. Geist's own `--ds-gray-alpha-400` is the same construct, and its solid twin `--ds-gray-400` is literally `#2e2e2e` (see §7). A solid `#2e2e2e` needs one `DesignTokenOverrides` entry |
| **`:focus-visible` ring** | Yes — two-layer ring, a 2px surface-colored gap then a 2px blue ring; "Ring focus is the keyboard contract: Tab (and Shift+Tab) walk the focusable widgets and draw the visible focus ring" ([docs/native-ui](https://native-sdk.dev/docs/native-ui)). Caveat from the same page: "Contrast checking and focus-visible styling checks are **not** part of the [a11y] audit yet" |
| Geist Sans / Mono | Yes, bundled; Latin-only coverage, which is fine here |
| **Negative letter-spacing** | **Not expressible.** `TypographyTokens` is `{ font_id, mono_font_id, font_family, mono_font_family, body_size, label_size, title_size, button_size, button_font_id, heading_size, display_size }` — eleven fields, **no letter-spacing or tracking field of any kind** ([`src/primitives/canvas/tokens.zig`](https://github.com/vercel-labs/native/blob/main/src/primitives/canvas/tokens.zig)). Geist's type ramp tightens tracking from -0.28px to -4.32px as size grows (see §7); none of that is reachable |
| **`tnum` tabular numerals** | **Not expressible.** Zero occurrences of "tabular", "tnum", or numeral-feature vocabulary in the token model, and there is no OpenType feature API. Grid-aligned numeric columns would fall back to Geist Sans' default figure widths, or to switching numeric cells to Geist Mono |

**Custom tokens are Zig-only.** Full authorship (`tokens_fn`, `DesignTokenOverrides`, per-control tables) is demonstrated exclusively in Zig, and the TypeScript tier is limited by its own type to `{ pack?, colorScheme?, accent? }` where `accent` must be exactly `#rrggbb`. So the moment you want a token the `geist` pack does not already give you — a solid `#2e2e2e` border, a different row extent — you are writing Zig. Confirmed against `@native-sdk/core@0.9.5`'s `events.d.ts`, whose only theming export is `ThemeState`.

One genuinely excellent property: themes are pixel-pinnable in CI. "Render a reference surface under it once, pin the pixel signature, and CI fails the moment any change moves a pixel of your design system." The SDK does exactly this for both built-in packs. ([docs/theming](https://native-sdk.dev/docs/theming))

---

## 7. What native-sdk.dev itself is built with

**It is a Next.js website. It is not built with Native SDK.**

From [`docs/package.json`](https://github.com/vercel-labs/native/blob/main/docs/package.json): `next ^16.2.9`, `react ^19`, `react-dom ^19`, `tailwindcss ^4`, `@tailwindcss/postcss ^4`, `radix-ui ^1.4.3`, `@next/mdx ^3`, `shiki ^4`, `next-themes`, `tailwind-merge`, `tailwindcss-animate`, and **`geist ^1.7.0`** (Vercel's official font package).

[`docs/src/app/layout.tsx`](https://github.com/vercel-labs/native/blob/main/docs/src/app/layout.tsx) imports `GeistSans` from `geist/font/sans`, `GeistMono` from `geist/font/mono`, and `GeistPixelSquare` from `geist/font/pixel` (the wordmark).

**Its visual style is Geist — the real thing, with the real token names.** [`docs/src/app/globals.css`](https://github.com/vercel-labs/native/blob/main/docs/src/app/globals.css) (12.4 KB) contains **212 lines referencing `--ds-*` custom properties**, with an explicit comment: "Geist color tokens (vercel.com/design.md). Step semantics: 100/200/300 default/hover/active backgrounds, 400/500/600 borders, 700/800 solid". Concretely:

- `--ds-gray-400: #2e2e2e;` — **the exact hairline colour the requirement names, verbatim, in this stylesheet**
- `--color-border: var(--ds-gray-alpha-400);` — the translucent twin, used for every hairline
- `border-bottom: 1px solid var(--ds-gray-alpha-400);` on table headers, `--ds-gray-alpha-200` on rows
- the Geist type ramp with tightening tracking: `letter-spacing` values of `-4.32px, -3.84px, -3.36px, -2.88px, -2.4px, -1.28px, -0.96px, -0.4px, -0.32px, -0.28px` across the size steps
- `--ease-geist: cubic-bezier(0.175, 0.885, 0.32, 1.1);`
- "Geist focus ring: a 2px surface-colored gap plus a 2px blue ring"

So the look the user likes is **Vercel Geist rendered by a browser via Tailwind v4 + CSS custom properties + Radix primitives** — not Native SDK output. The only engine-rendered pixels on the site are the component previews, which run the reference renderer compiled to WebAssembly (`docs/public/wasm/component-preview.wasm`, wired through `docs/src/components/component-preview-live.tsx`).

Practical implication: **the site's exact look is reproducible today with an ordinary web stack** (Next or Vite + Tailwind v4 + the `geist` npm package + Radix or shadcn/ui), and that stack gives you `letter-spacing` and `font-variant-numeric: tabular-nums` — the two Geist details Native SDK's token model cannot express (§6). If the goal is "make it look like native-sdk.dev", the website's own stack is the higher-fidelity choice.

---

## 8. Honest risk assessment

For a solo developer, four users, no deadline, the calculus is unusual. No deadline means "the tool matures under me" is a legitimate bet, and four users means abandonment is survivable. So the risk here is not business risk. It is **blocked-forever risk**, and it is concrete rather than speculative.

**Blockers that are architectural, not schedule.**

1. **1,700 animated GIFs against a 16-slot, 8-MiB-per-slot image registry with no GIF decoder and no animation primitive.** This is not on any visible roadmap and is not a "wait for v1.0" item — it would require a codec, a frame-timing subsystem, and a registry redesign. This alone disqualifies the stack for this app.
2. **Single `.exe`: not supported, and the asset model points away from it.** Windows packaging emits a directory and is "in early development". `@embedFile` in a Zig core could embed the bytes, but there is no path from embedded bytes to 155 MB of renderable sprites given (1).
3. **Virtualized table from TypeScript: not available.** The real virtual list is Zig-builder-only, and `table` has no virtualization at all.
4. **Two Geist typography details are unreachable** — negative tracking and tabular numerals — in a project whose stated goal is faithful Geist reproduction.

**Project risks, ranked.**

- **Bus factor 1.** 419 of 424 commits belong to one person. If `ctate` moves teams, the toolkit stops. Vercel Labs is not a support commitment and nothing on the repo claims otherwise.
- **Pre-1.0 churn is real, not theoretical.** Renamed from `zero-native` to `native`; `app.zon` to `app.json` default inside a minor. Every upgrade over the next year will cost you.
- **A broken quickstart on your exact platform.** [#365](https://github.com/vercel-labs/native/issues/365) means `native dev` on Windows 11 with Node 24.18 fails on a freshly scaffolded app, unfixed after five days, with a second reporter on Linux. You would debug the toolchain before writing a line of app code.
- **Maintenance throughput.** 67 open PRs and 74 open issues against 28 closed issues. Your bug report joins a queue triaged by one person.
- **You would be an early adopter on the least-tested host.** macOS is where the maintainer works and where the deep features live; Windows gets one CI job.

**What would be irrecoverable if it were abandoned.** Less than you might fear, and more than zero.

- **Recoverable:** the domain logic. A pure TypeScript `Model`/`Msg`/`update` is framework-agnostic and ports to anything. The dataset and the sprite pipeline are yours.
- **Irrecoverable:** every `.native` view file. It is a closed, proprietary markup grammar with exactly one implementation, whose compiler is a Zig program in one repo. There is no second renderer, no spec, no export. If the project dies you rewrite 100% of the UI.
- **Also irrecoverable:** any Zig you write to work around the TypeScript tier's limits — and given §5 and §6, this app would force a lot of that. You would be learning Zig 0.16 (itself pre-1.0) in order to build a Pokémon table.
- **The skill investment.** Time spent on Native markup, the token model and `scriptc` quirks transfers to nothing else. Time spent on React + Tailwind + Geist transfers everywhere.

**What a mature stack costs instead.** Tauri v2 or Electron gives a real single-file portable exe path, actual GIF playback via `<img>`, real virtualization (TanStack Virtual), literal Geist CSS including `letter-spacing` and `tnum`, and shadcn/ui — at the price of a webview dependency (Tauri, WebView2, present on Windows 11) or a ~150 MB Chromium (Electron, which the stated 400 MB budget accommodates). The one thing Native SDK offers that they do not — a few-MB binary with no runtime — is precisely the requirement already waived.

**Recommendation.** Do not build this app on Native SDK. Watch it: the project is legitimately impressive, ships twice a week, and its built-in `geist` pack is the best out-of-the-box Geist implementation outside a browser. Re-evaluate at v1.0, or when the image registry grows an animation story. For this app, today, it cannot do the two things that define it.

---

## Appendix — sources

- Repo: https://github.com/vercel-labs/native
- Docs home: https://native-sdk.dev
- Introduction: https://native-sdk.dev/docs/introduction
- Quick start: https://native-sdk.dev/docs/quick-start
- Platform support: https://native-sdk.dev/docs/platform-support
- Packaging: https://native-sdk.dev/docs/packaging
- Theming: https://native-sdk.dev/docs/theming
- Fonts: https://native-sdk.dev/docs/fonts
- Native UI (markup reference): https://native-sdk.dev/docs/native-ui
- Dynamic images: https://native-sdk.dev/docs/dynamic-images
- App manifest: https://native-sdk.dev/docs/app-zon
- Components — table: https://native-sdk.dev/docs/components/table
- Components — list: https://native-sdk.dev/docs/components/list
- Components — virtual list: https://native-sdk.dev/docs/components/virtual-list
- Components — video: https://native-sdk.dev/docs/components/video
- Components — media surface: https://native-sdk.dev/docs/components/media-surface
- Source — image limits: https://github.com/vercel-labs/native/blob/main/src/runtime/canvas_limits.zig
- Source — design tokens: https://github.com/vercel-labs/native/blob/main/src/primitives/canvas/tokens.zig
- Source — geist pack: https://github.com/vercel-labs/native/blob/main/src/primitives/canvas/themes/geist.zig
- Source — CI: https://github.com/vercel-labs/native/blob/main/.github/workflows/ci.yml
- Site CSS: https://github.com/vercel-labs/native/blob/main/docs/src/app/globals.css
- Site deps: https://github.com/vercel-labs/native/blob/main/docs/package.json
- npm: https://www.npmjs.com/package/@native-sdk/cli and https://www.npmjs.com/package/@native-sdk/core
- Issues cited: [#365](https://github.com/vercel-labs/native/issues/365), [#261](https://github.com/vercel-labs/native/issues/261), [#53](https://github.com/vercel-labs/native/issues/53), [#13](https://github.com/vercel-labs/native/issues/13), [#7](https://github.com/vercel-labs/native/issues/7)
