import * as React from "react"
import { Link } from "@tanstack/react-router"
import { TYPE_HEX } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)"
const DARK_TEXT = new Set(["Electric", "Ice", "Bug", "Fairy"])

function shade(hex: string, t: number): string {
  const n = hex.replace("#", "")
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  const mix = (c: number) => Math.round(Math.min(255, Math.max(0, c * t)))
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`
}

export function TypeGem({
  type,
  size = 56,
  selected,
  dim,
  label,
  mark,
  markColor,
  onClick,
  toHub,
  title,
}: {
  type: string
  size?: number
  selected?: boolean
  dim?: boolean
  label?: string
  mark?: string
  markColor?: string
  onClick?: () => void
  toHub?: boolean
  title?: string
}) {
  const { typeName } = useI18n()
  const hex = TYPE_HEX[type] ?? "#888888"
  const dark = DARK_TEXT.has(type)
  const h = Math.round(size * 1.12)
  const style: React.CSSProperties = {
    width: size,
    height: h,
    clipPath: HEX,
    background: `radial-gradient(circle at 32% 28%, ${shade(hex, 1.35)} 0%, ${hex} 46%, ${shade(hex, 0.42)} 100%)`,
    color: dark ? "#111" : "#fff",
    boxShadow: selected
      ? `0 0 0 2px #fff, 0 0 28px ${hex}, inset 0 1px 8px #fff6`
      : `inset 0 1px 10px #fff3, 0 6px 16px #00000088`,
    filter: dim ? "saturate(0.35) brightness(0.7)" : undefined,
    fontSize: size < 48 ? 9 : size < 64 ? 10 : 11,
  }

  const inner = (
    <span className="flex flex-col items-center justify-center px-1 text-center font-bold uppercase leading-tight tracking-wide drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
      <span>{label ?? typeName(type)}</span>
      {mark ? (
        <span className="tnum font-black normal-case tracking-normal" style={{ color: markColor, fontSize: size < 56 ? 11 : 13 }}>
          {mark}
        </span>
      ) : null}
    </span>
  )

  const className = cn(
    "inline-flex items-center justify-center shrink-0 transition-transform duration-200",
    onClick || toHub ? "cursor-pointer hover:scale-105 hover:brightness-110" : "",
  )

  if (toHub) {
    return (
      <Link
        to="/types/$typeId"
        params={{ typeId: type } as never}
        title={title ?? typeName(type)}
        className={className}
        style={style}
      >
        {inner}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" title={title ?? typeName(type)} onClick={onClick} className={className} style={style}>
        {inner}
      </button>
    )
  }
  return (
    <span title={title ?? typeName(type)} className={className} style={style}>
      {inner}
    </span>
  )
}
