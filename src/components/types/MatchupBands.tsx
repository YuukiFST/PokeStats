import { LinkedTypeBadge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MatchupBand, MatchupMult } from "@/lib/domain/typeChart"
import { useI18n } from "@/lib/i18n"

const TONE: Record<MatchupMult, string> = {
  4: "border-[var(--ds-red-700)]/50 bg-[var(--ds-red-700)]/12",
  2: "border-red-400/40 bg-red-400/10",
  0.5: "border-emerald-500/40 bg-emerald-500/10",
  0.25: "border-emerald-700/50 bg-emerald-700/15",
  0: "border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)]/60",
}

const NUM: Record<MatchupMult, string> = {
  4: "text-[var(--ds-red-700)]",
  2: "text-red-400",
  0.5: "text-emerald-500",
  0.25: "text-emerald-600",
  0: "text-[var(--ds-gray-700)]",
}

const GLYPH: Record<MatchupMult, string> = {
  4: "4×",
  2: "2×",
  0.5: "½×",
  0.25: "¼×",
  0: "0×",
}

export function MatchupBands({
  bands,
  empty,
}: {
  bands: MatchupBand[]
  empty?: string
}) {
  const { t } = useI18n()
  if (!bands.length) {
    return <p className="text-sm text-[var(--ds-gray-700)]">{empty ?? t("types.neutralOnly")}</p>
  }
  return (
    <div className="space-y-2">
      {bands.map((b) => (
        <div key={b.mult} className={cn("rounded-md border px-3 py-2", TONE[b.mult])}>
          <div className={cn("text-[11px] font-semibold uppercase tracking-wide mb-1.5 tnum", NUM[b.mult])}>
            {GLYPH[b.mult]}
            <span className="ml-2 font-medium normal-case tracking-normal text-[var(--ds-gray-900)]">
              {b.mult === 4
                ? t("types.band4")
                : b.mult === 2
                  ? t("types.band2")
                  : b.mult === 0.5
                    ? t("types.bandHalf")
                    : b.mult === 0.25
                      ? t("types.bandQuarter")
                      : t("types.band0")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {b.types.map((tt) => (
              <LinkedTypeBadge key={tt} type={tt} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
