import { invoke } from "@tauri-apps/api/core"

let sent = false

/** Tell the native shell the WebView has a painted frame. Idempotent. No-op outside Tauri. */
export function signalShellReady(reason: string): void {
  if (sent) return
  sent = true
  document.documentElement.removeAttribute("data-booting")
  console.log(`[perf] shell ready (${reason}) ${performance.now().toFixed(1)}ms`)
  invoke("shell_ready").catch(() => {})
}

function whenImagesSettled(root: Element, capMs: number): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"))
  const pending = imgs.filter((img) => !img.complete)
  if (pending.length === 0) return Promise.resolve()
  return new Promise((resolve) => {
    let left = pending.length
    const done = () => {
      left -= 1
      if (left <= 0) {
        window.clearTimeout(cap)
        resolve()
      }
    }
    const cap = window.setTimeout(resolve, capMs)
    for (const img of pending) {
      img.addEventListener("load", done, { once: true })
      img.addEventListener("error", done, { once: true })
    }
  })
}

/**
 * Wait until an element matching `selector` is in the DOM (the first route's
 * real content), wait for in-view images to decode, give the compositor two
 * frames, then signal. Caps at `maxFrames` frames or `maxMs` ms so a
 * slow/failed route still reveals.
 */
export function signalWhenPainted(selector: string, maxFrames = 90, maxMs = 1500): void {
  let frames = 0
  const timeout = window.setTimeout(() => signalShellReady("timeout"), maxMs)
  const finish = (reason: string) => {
    window.clearTimeout(timeout)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => signalShellReady(reason))
    })
  }
  const tick = () => {
    frames++
    const el = document.querySelector(selector)
    if (el) {
      const root = document.getElementById("root") ?? el
      void whenImagesSettled(root, 250).then(() => finish("content"))
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
