import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/**
 * Rich hover/focus tooltip. Portal-based so it survives overflow containers
 * (same scheme as HelpTip), but takes a ReactNode so callers can render
 * structured label/value rows. Opens on hover and keyboard focus; Esc or blur
 * dismisses. Flips above the trigger when the viewport bottom is tight.
 */
export function InfoTip({
  children,
  tip,
  className,
  width = 272,
}: {
  children: React.ReactNode
  tip: React.ReactNode
  className?: string
  width?: number
}) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLSpanElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)

  const updatePos = React.useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const h = tipRef.current?.offsetHeight ?? 0
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8))
    let top = r.bottom + 8
    if (h > 0 && top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8)
    setPos({ top, left })
  }, [width])

  React.useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener("scroll", updatePos, true)
    window.addEventListener("resize", updatePos)
    return () => {
      window.removeEventListener("scroll", updatePos, true)
      window.removeEventListener("resize", updatePos)
    }
  }, [open, updatePos])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className="pointer-events-none fixed z-[9999] rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-2.5 text-xs leading-snug text-[var(--ds-gray-900)] shadow-lg"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
          >
            {tip}
          </div>,
          document.body,
        )}
    </span>
  )
}

/** Label/value row inside an InfoTip — label fixed muted column, value flows. */
export function TipRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-x-2">
      <span className="text-[var(--ds-gray-700)]">{label}</span>
      <span className="inline-flex items-center gap-1.5 min-w-0">{children}</span>
    </div>
  )
}
