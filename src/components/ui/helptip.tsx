import * as React from "react"
import { createPortal } from "react-dom"

const VIEWPORT_MARGIN = 8

/**
 * Shared hover/click glossary tip. Portal-based so it survives overflow
 * containers (virtualized dex rows, sticky headers).
 */
export function HelpTip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = React.useState(false)
  const btnRef = React.useRef<HTMLButtonElement>(null)
  const tipRef = React.useRef<HTMLSpanElement>(null)
  const [anchor, setAnchor] = React.useState({ top: 0, left: 0 })
  const [tipPos, setTipPos] = React.useState<{ top: number; left: number } | null>(null)
  const updateAnchor = React.useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setAnchor({ top: r.bottom + 8, left: r.left + r.width / 2 })
  }, [])
  // The centered position clips near window edges, so measure the rendered tip
  // and clamp it inside the viewport (flipping above when there is no room below).
  React.useLayoutEffect(() => {
    if (!open) {
      setTipPos(null)
      return
    }
    const el = tipRef.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const minLeft = VIEWPORT_MARGIN + w / 2
    const maxLeft = Math.max(minLeft, window.innerWidth - VIEWPORT_MARGIN - w / 2)
    const left = Math.min(Math.max(anchor.left, minLeft), maxLeft)
    let top = anchor.top
    if (top + h > window.innerHeight - VIEWPORT_MARGIN) {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) top = Math.max(VIEWPORT_MARGIN, r.top - VIEWPORT_MARGIN - h)
    }
    setTipPos({ top, left })
  }, [open, anchor])
  React.useEffect(() => {
    if (!open) return
    updateAnchor()
    window.addEventListener("scroll", updateAnchor, true)
    window.addEventListener("resize", updateAnchor)
    return () => {
      window.removeEventListener("scroll", updateAnchor, true)
      window.removeEventListener("resize", updateAnchor)
    }
  }, [open, updateAnchor])
  return (
    <span className="inline-flex">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-[10px] font-medium leading-none text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)] hover:border-[var(--ds-gray-600)] transition-colors align-middle"
        aria-label={label ?? "?"}
      >
        ?
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            role="tooltip"
            className="fixed z-[9999] w-64 max-w-[calc(100vw-16px)] -translate-x-1/2 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-2.5 text-xs leading-tight text-[var(--ds-gray-900)] shadow-lg pointer-events-none"
            style={{ top: tipPos?.top ?? anchor.top, left: tipPos?.left ?? anchor.left, visibility: tipPos ? undefined : "hidden" }}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
