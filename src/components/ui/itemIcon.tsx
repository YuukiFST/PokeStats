import type { ItemInfo } from "@/lib/domain/types"
import { cn } from "@/lib/utils"

/** 24×24 cell of the vendored Showdown itemicons sheet, positioned by spriteNum. */
export function ItemIcon({
  item,
  size = 24,
  className,
}: {
  item: ItemInfo | undefined
  size?: number
  className?: string
}) {
  if (!item || item.spriteNum === null) return null
  const cell = 24
  const scale = size / cell
  const left = (item.spriteNum % 16) * cell
  const top = Math.floor(item.spriteNum / 16) * cell
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 overflow-hidden", className)}
      style={{ width: size, height: size }}
    >
      <span
        className="block h-6 w-6 bg-no-repeat"
        style={{
          backgroundImage: "url(/sprites/itemicons-sheet.png)",
          backgroundPosition: `-${left}px -${top}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </span>
  )
}
