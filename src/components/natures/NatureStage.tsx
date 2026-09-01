import { natureAt, natureFactor, NATURE_STAT_KEYS } from "@/lib/domain/natures"
import type { NatureInfo, StatKey } from "@/lib/domain/types"
import { STAT_LABEL, cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

/** Sweepers first: Spe / Atk / SpA, then bulk. */
const COLS: StatKey[] = ["spe", "atk", "spa", "def", "spd"]

const TONE: Record<StatKey, string> = {
  hp: "#8f8f8f",
  atk: "#f13242",
  def: "#4a90e2",
  spa: "#c472fb",
  spd: "#00c9b5",
  spe: "#ffb200",
}

export function NatureStage({
  selected,
  onSelect,
}: {
  selected: NatureInfo
  onSelect: (n: NatureInfo) => void
}) {
  const { t } = useI18n()
  const plusLabel = selected.plus ? `+${STAT_LABEL[selected.plus]}` : t("natures.neutral")
  const minusLabel = selected.minus ? `−${STAT_LABEL[selected.minus]}` : t("natures.neutral")

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#050505]">
      <div className="shrink-0 px-6 py-5 border-b border-white/10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">{t("natures.title")}</div>
          <h2 className="text-4xl font-semibold tracking-tight text-white mt-1">{selected.name}</h2>
          <p className="mt-2 text-base font-semibold">
            <span className="text-emerald-400">{plusLabel}</span>
            <span className="text-white/25"> · </span>
            <span className={selected.minus ? "text-red-400" : "text-white/45"}>{minusLabel}</span>
          </p>
        </div>
        <div className="flex gap-4">
          {NATURE_STAT_KEYS.map((stat) => {
            const f = natureFactor(selected, stat)
            return (
              <div key={stat} className="w-14 text-center">
                <div className="text-[10px] font-bold text-white/50">{STAT_LABEL[stat]}</div>
                <div
                  className={cn(
                    "mt-1 text-sm font-semibold tnum",
                    f === 1.1 ? "text-emerald-400" : f === 0.9 ? "text-red-400" : "text-white/40",
                  )}
                >
                  {f === 1.1 ? t("natures.up") : f === 0.9 ? t("natures.down") : t("natures.flat")}
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: f === 1.1 ? "100%" : f === 0.9 ? "55%" : "78%",
                      background: f === 1.1 ? "#00ca52" : f === 0.9 ? "#f13242" : "#454545",
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-5">
        <div className="grid grid-cols-5 gap-3 max-w-5xl mx-auto">
          {COLS.map((plus) => (
            <div key={plus}>
              <div
                className="mb-2 rounded-lg px-2 py-1.5 text-center text-[12px] font-bold tracking-wide"
                style={{ background: `${TONE[plus]}22`, color: TONE[plus] }}
              >
                +{STAT_LABEL[plus]}
              </div>
              <div className="space-y-1.5">
                {[...NATURE_STAT_KEYS.filter((m) => m !== plus), plus].map((minus) => {
                  const n = natureAt(plus, minus)!
                  const on = n.name === selected.name
                  const neutral = plus === minus
                  return (
                    <button
                      key={n.name}
                      type="button"
                      onClick={() => onSelect(n)}
                      className={cn(
                        "w-full rounded-lg border px-2 py-2.5 text-left transition-colors",
                        on
                          ? "border-white bg-white text-black"
                          : "border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.09] hover:border-white/25",
                      )}
                    >
                      <div className="font-semibold leading-tight">{n.name}</div>
                      <div className={cn("text-[11px] tnum mt-0.5", on ? "text-black/55" : "text-white/45")}>
                        {neutral ? t("natures.neutral") : `−${STAT_LABEL[minus]}`}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

