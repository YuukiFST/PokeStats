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
