import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] px-2 py-0.5 text-xs font-medium text-[var(--ds-gray-900)] min-w-[52px] h-[20px]",
        className,
      )}
      {...props}
    />
  )
}

/** Solid chip look per type — single source shared by TypeBadge and the Dex filter chips. */
export const TYPE_CHIP: Record<string, { solid: string; soft: string }> = {
  Normal: { solid: "bg-[#9aa0a6] text-white border-[#9aa0a6]", soft: "bg-[#9aa0a6]/15 text-[#9aa0a6] border-[#9aa0a6]/50" },
  Fire: { solid: "bg-[#e85d26] text-white border-[#e85d26]", soft: "bg-[#e85d26]/15 text-[#e85d26] border-[#e85d26]/50" },
  Water: { solid: "bg-[#4a90e2] text-white border-[#4a90e2]", soft: "bg-[#4a90e2]/15 text-[#4a90e2] border-[#4a90e2]/50" },
  Electric: { solid: "bg-[#f5c518] text-black border-[#f5c518]", soft: "bg-[#f5c518]/15 text-[#b98d00] border-[#f5c518]/60" },
  Grass: { solid: "bg-[#4caf50] text-white border-[#4caf50]", soft: "bg-[#4caf50]/15 text-[#4caf50] border-[#4caf50]/50" },
  Ice: { solid: "bg-[#7ec8c0] text-black border-[#7ec8c0]", soft: "bg-[#7ec8c0]/15 text-[#3d8a80] border-[#7ec8c0]/60" },
  Fighting: { solid: "bg-[#c03028] text-white border-[#c03028]", soft: "bg-[#c03028]/15 text-[#c03028] border-[#c03028]/50" },
  Poison: { solid: "bg-[#9c27b0] text-white border-[#9c27b0]", soft: "bg-[#9c27b0]/15 text-[#9c27b0] border-[#9c27b0]/50" },
  Ground: { solid: "bg-[#c19a6b] text-white border-[#c19a6b]", soft: "bg-[#c19a6b]/15 text-[#96754a] border-[#c19a6b]/60" },
  Flying: { solid: "bg-[#90a4ae] text-white border-[#90a4ae]", soft: "bg-[#90a4ae]/15 text-[#78909c] border-[#90a4ae]/60" },
  Psychic: { solid: "bg-[#f06292] text-white border-[#f06292]", soft: "bg-[#f06292]/15 text-[#f06292] border-[#f06292]/50" },
  Bug: { solid: "bg-[#8bc34a] text-black border-[#8bc34a]", soft: "bg-[#8bc34a]/15 text-[#689f38] border-[#8bc34a]/60" },
  Rock: { solid: "bg-[#b0a082] text-white border-[#b0a082]", soft: "bg-[#b0a082]/15 text-[#8f7f5f] border-[#b0a082]/60" },
  Ghost: { solid: "bg-[#6756a5] text-white border-[#6756a5]", soft: "bg-[#6756a5]/15 text-[#8b7dd0] border-[#6756a5]/50" },
  Dragon: { solid: "bg-[#5865d6] text-white border-[#5865d6]", soft: "bg-[#5865d6]/15 text-[#5865d6] border-[#5865d6]/50" },
  Dark: { solid: "bg-[#5d4037] text-white border-[#5d4037]", soft: "bg-[#5d4037]/25 text-[#a1887f] border-[#5d4037]/60" },
  Steel: { solid: "bg-[#78909c] text-white border-[#78909c]", soft: "bg-[#78909c]/15 text-[#90a4ae] border-[#78909c]/60" },
  Fairy: { solid: "bg-[#ffb6d9] text-black border-[#ffb6d9]", soft: "bg-[#ffb6d9]/20 text-[#d16b9c] border-[#ffb6d9]/70" },
}

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  const { typeName } = useI18n()
  return (
    <span
      className={cn(
        // min-w instead of fixed w: pt-BR labels (Fantasma, Elétrico) are longer than EN
        "inline-flex items-center justify-center rounded-md text-[11px] font-semibold tracking-wide border uppercase min-w-[62px] px-1 h-[20px] shrink-0",
        TYPE_CHIP[type]?.solid ?? "bg-[var(--ds-gray-100)] border-[var(--ds-gray-400)] text-[var(--ds-gray-900)]",
        className,
      )}
    >
      {typeName(type)}
    </span>
  )
}

/**
 * Smart redirect: any Type chip that is not itself a filter control links to
 * the Type hub (/types/$typeId) — strengths, weaknesses, top Forms and Moves.
 * Use plain TypeBadge inside interactive parents (filter buttons, result rows).
 */
export function LinkedTypeBadge({ type, className }: { type: string; className?: string }) {
  const { typeName } = useI18n()
  return (
    <Link
      to="/types/$typeId"
      params={{ typeId: type } as never}
      title={`${typeName(type)} — open Type hub`}
      className="shrink-0 rounded-md transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ds-blue-700)]"
    >
      <TypeBadge type={type} className={className} />
    </Link>
  )
}
