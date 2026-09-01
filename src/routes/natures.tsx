import { useNavigate, useSearch } from "@tanstack/react-router"
import { NatureStage } from "@/components/natures/NatureStage"
import { NATURES } from "@/lib/domain/natures"
import type { NatureInfo } from "@/lib/domain/types"
import { useI18n } from "@/lib/i18n"

export type NaturesSearch = { n?: string }

export function NaturesPage() {
  const search = useSearch({ strict: false }) as NaturesSearch
  const navigate = useNavigate()
  const { t } = useI18n()

  const selected: NatureInfo =
    NATURES.find((n) => n.name === search.n) ?? NATURES.find((n) => n.name === "Timid")!

  const pick = (n: NatureInfo) => {
    navigate({ to: "/natures", search: { n: n.name } as never })
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#050505]">
      <div className="shrink-0 px-5 py-3 border-b border-white/5">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">{t("natures.title")}</div>
        <p className="text-xs text-white/55 mt-0.5">{t("natures.desc")}</p>
      </div>
      <div className="flex-1 min-h-0">
        <NatureStage selected={selected} onSelect={pick} />
      </div>
    </div>
  )
}