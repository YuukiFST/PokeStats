import * as React from "react"

/**
 * Saved-offset restore for virtualized lists that own their own scroller.
 * - `initialOffset` feeds useVirtualizer so the first render already lays out
 *   the rows at the saved position (no double-rAF jump).
 * - The layout effect sets scrollTop before paint once `ready` is true.
 * - Position is persisted on `scrollend` (Chromium) or rAF-coalesced `scroll`.
 */
export function useRestoredScroll(
  ref: React.RefObject<HTMLElement | null>,
  key: string,
  ready: boolean,
): { initialOffset: number; saveNow: () => void } {
  const initial = React.useRef<number | null>(null)
  if (initial.current === null) {
    const raw = sessionStorage.getItem(key)
    const n = raw === null ? 0 : Number(raw)
    initial.current = Number.isFinite(n) && n > 0 ? n : 0
  }
  const restored = React.useRef(false)

  const saveNow = React.useCallback(() => {
    const el = ref.current
    if (el) sessionStorage.setItem(key, String(el.scrollTop))
  }, [ref, key])

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ready) return
    if (!restored.current) {
      restored.current = true
      if (initial.current) el.scrollTop = initial.current
    }
    const save = () => sessionStorage.setItem(key, String(el.scrollTop))
    if ("onscrollend" in window) {
      el.addEventListener("scrollend", save, { passive: true })
      return () => el.removeEventListener("scrollend", save)
    }
    let pending = false
    const onScroll = () => {
      if (pending) return
      pending = true
      requestAnimationFrame(() => {
        pending = false
        save()
      })
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [ref, key, ready])

  return { initialOffset: initial.current, saveNow }
}