import { useNavigate, useSearch } from "@tanstack/react-router"
import { SetUseList } from "@/components/sets/SetUseList"
import { natureAt, natureCellStats, NATURE_STAT_KEYS, NATURES, setsUsingNature } from "@/lib/domain/natures"
import type { NatureInfo, StatKey } from "@/lib/domain/types"
import { STAT_LABEL, cn } from "@/lib/utils"
import { useDataset } from "@/hooks/useDataset"
import { useI18n } from "@/lib/i18n"

export type NaturesSearch = { n?: string }

export function NaturesPage() {
  const search = useSearch({ strict: false }) as NaturesSearch
  const navigate = useNavigate()
  const { data, extrasReady } = useDataset()
  const { t } = useI18n()

  const selected: NatureInfo =
    NATURES.find((n) => n.name === search.n) ?? NATURES.find((n) => n.name === "Timid")!

  const cell = natureCellStats(selected)!
  const uses = data ? setsUsingNature(data.sets.sets, selected.name) : []

  const pick = (plus: StatKey, minus: StatKey) => {
    const n = natureAt(plus, minus)
    if (!n) return
    navigate({ to: "/natures", search: { n: n.name } as never })
  }

  const plusLabel = selected.plus ? `+${STAT_LABEL[selected.plus]}` : t("natures.neutral")
  const minusLabel = selected.minus ? `−${STAT_LABEL[selected.minus]}` : t("natures.neutral")

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">{t("natures.title")}</h1>
        <p className="text-xs text-[var(--ds-gray-700)] mt-1 max-w-xl">{t("natures.desc")}</p>
      </div>

      <div className="p-6 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4 overflow-auto">
          <table className="border-separate border-spacing-1 w-full min-w-[420px]">
            <thead>
              <tr>
                <th className="text-[10px] font-medium text-[var(--ds-gray-700)] text-left pr-2 w-14">
                  {t("natures.plus")} \ {t("natures.minus")}
                </th>
                {NATURE_STAT_KEYS.map((minus) => (
                  <th key={minus} className="text-[11px] font-semibold text-center text-[var(--ds-gray-900)]">
                    −{STAT_LABEL[minus]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NATURE_STAT_KEYS.map((plus) => (
                <tr key={plus}>
                  <th className="text-[11px] font-semibold text-left text-emerald-600">+{STAT_LABEL[plus]}</th>
                  {NATURE_STAT_KEYS.map((minus) => {
                    const n = natureAt(plus, minus)!
                    const on = n.name === selected.name
                    const cross = plus === cell.plus || minus === cell.minus
                    const diagonal = plus === minus
                    return (
                      <td key={minus}>
                        <button
                          type="button"
                          onClick={() => pick(plus, minus)}
                          aria-pressed={on}
                          className={cn(
                            "w-full h-12 rounded-md border text-[11px] font-medium transition-colors",
                            on
                              ? "border-[var(--ds-blue-700)] bg-[var(--ds-blue-700)] text-white"
                              : diagonal
                                ? "border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)]"
                                : cross
                                  ? "border-[var(--ds-gray-400)] bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)] hover:border-[var(--ds-blue-700)]"
                                  : "border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] text-[var(--ds-gray-900)] hover:border-[var(--ds-blue-700)] hover:bg-[var(--ds-gray-100)]",
                          )}
                        >
                          {n.name}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] overflow-hidden h-fit">
          <div className="px-4 py-4 border-b border-[var(--ds-gray-300)]">
            <div className="text-xs text-[var(--ds-gray-700)]">{t("natures.title")}</div>
            <h2 className="text-2xl font-semibold tracking-tight">{selected.name}</h2>
            <p className="mt-2 text-sm">
              <span className="text-emerald-500 font-semibold tnum">{plusLabel}</span>
              {selected.plus || selected.minus ? <span className="text-[var(--ds-gray-700)]"> · </span> : null}
              {selected.minus ? <span className="text-red-400 font-semibold tnum">{minusLabel}</span> : null}
            </p>
            <p className="text-xs text-[var(--ds-gray-700)] mt-2">{t("natures.modHint")}</p>
          </div>
          <div className="px-4 py-2 text-xs font-medium text-[var(--ds-gray-700)] border-b border-[var(--ds-gray-300)]">
            {t("natures.usedBy")}
          </div>
          <SetUseList sets={uses} extrasReady={extrasReady} empty={t("natures.noSets")} />
        </aside>
      </div>
    </div>
  )
}
