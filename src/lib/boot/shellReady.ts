import { invoke } from "@tauri-apps/api/core"

let sent = false

/** Tell the native shell the WebView has a painted frame. Idempotent. No-op outside Tauri. */
export function signalShellReady(reason: string): void {
  if (sent) return
  sent = true
  shellReadyAt = performance.now()
  document.documentElement.removeAttribute("data-booting")
  console.log(`[perf] shell ready (${reason}) ${performance.now().toFixed(1)}ms`)
  invoke("shell_ready").catch(() => {})
  reportFramePresented()
  window.setTimeout(reportBootMarks, 1000)
}

/**
 * The native side shows the window transparent so WebView2 can present its
 * first frame before anything is on screen. Once two animation frames have
 * run with the document visible, at least one frame has been composited, and
 * the window can become opaque. Never fires while hidden: rAF is paused there.
 */
function reportFramePresented(): void {
  let frames = 0
  const tick = () => {
    if (document.visibilityState === "visible") frames++
    if (frames >= 2) {
      invoke("frame_presented").catch(() => {})
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/**
 * Attribution only (never the benchmark): resource/paint timeline relative to
 * the document's timeOrigin, written to the native boot log after reveal so it
 * costs nothing on the startup path. Read with POKESTATS_BOOT_LOG=1.
 */
function reportBootMarks(): void {
  try {
    const r = (ms: number) => Math.round(ms)
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    const pick = (re: RegExp) => {
      const e = res.find((x) => re.test(x.name))
      return e ? `${r(e.startTime)}-${r(e.responseEnd)}` : "-"
    }
    const sprites = res.filter((x) => /\/sprites\/still\//.test(x.name))
    const spriteSpan = sprites.length
      ? `${r(Math.min(...sprites.map((s) => s.startTime)))}-${r(Math.max(...sprites.map((s) => s.responseEnd)))} (n=${sprites.length})`
      : "-"
    const paint = performance.getEntriesByType("paint").map((p) => `${p.name.replace("first-", "")}=${r(p.startTime)}`).join(" ")
    const lines = [
      `nav resp=${nav ? r(nav.responseEnd) : "-"} domInteractive=${nav ? r(nav.domInteractive) : "-"} dcl=${nav ? r(nav.domContentLoadedEventEnd) : "-"}`,
      `index.js=${pick(/assets\/index-.*\.js/)} css=${pick(/assets\/index-.*\.css/)} i18n=${pick(/assets\/i18n-/)} logo=${pick(/logo\.webp/)}`,
      `dex.json=${pick(/dataset\/dex\.json/)} manifest=${pick(/sprites\/manifest/)} catalog=${pick(/dataset\/catalog/)}`,
      `sprites=${spriteSpan}`,
      `paint ${paint} react-first-effect=${r(firstEffectAt)} shell-ready=${r(shellReadyAt)}`,
    ]
    for (const line of lines) void invoke("boot_mark", { name: line }).catch(() => {})
  } catch {
    // attribution is best-effort
  }
}

let firstEffectAt = 0
let shellReadyAt = 0
/** Called from App's first effect; records when React committed its first tree. */
export function markFirstEffect(): void {
  if (!firstEffectAt) firstEffectAt = performance.now()
}

/**
 * Resolves once every `<img>` under `root` is decoded (not just loaded — a
 * loaded-but-undecoded image paints a frame late). Capped so a broken sprite
 * cannot hold the window hidden.
 */
function whenImagesDecoded(root: Element, capMs: number): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"))
  if (imgs.length === 0) return Promise.resolve()
  const all = Promise.all(imgs.map((img) => img.decode().catch(() => {})))
  const cap = new Promise<void>((resolve) => window.setTimeout(resolve, capMs))
  return Promise.race([all.then(() => {}), cap])
}

/**
 * Wait until an element matching `selector` is in the DOM (the first route's
 * real content), wait for in-view images to decode, let one frame commit,
 * then signal. Caps at `maxFrames` frames or `maxMs` ms so a slow/failed
 * route still reveals.
 */
export function signalWhenPainted(selector: string, maxFrames = 90, maxMs = 1500): void {
  let frames = 0
  const timeout = window.setTimeout(() => signalShellReady("timeout"), maxMs)
  const finish = (reason: string) => {
    window.clearTimeout(timeout)
    requestAnimationFrame(() => signalShellReady(reason))
  }
  const tick = () => {
    frames++
    const el = document.querySelector(selector)
    if (el) {
      const root = document.getElementById("root") ?? el
      void whenImagesDecoded(root, 250).then(() => finish("content"))
      return
    }
    if (frames >= maxFrames) {
      finish("frames")
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
