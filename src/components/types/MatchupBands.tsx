import { TypeGem } from "@/components/types/TypeGem"
import type { MatchupBand, MatchupMult } from "@/lib/domain/typeChart"
import { useI18n } from "@/lib/i18n"

const COLOR: Record<MatchupMult, string> = {
  4: "#f13242",
  2: "#ff5e63",
  0.5: "#00ca52",
  0.25: "#00ab3e",
  0: "#8f8f8f",
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
  const caption = (m: MatchupMult) =>
    m === 4 ? t("types.band4") : m === 2 ? t("types.band2") : m === 0.5 ? t("types.bandHalf") : m === 0.25 ? t("types.bandQuarter") : t("types.band0")
  return (
    <div className="space-y-4">
      {bands.map((b) => (
        <div key={b.mult}>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-semibold tnum leading-none" style={{ color: COLOR[b.mult] }}>
              {GLYPH[b.mult]}
            </span>
            <span className="text-[11px] text-[var(--ds-gray-700)]">{caption(b.mult)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {b.types.map((tt) => (
              <TypeGem key={tt} type={tt} size={46} toHub />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
