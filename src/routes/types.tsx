import * as React from "react"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { TYPE_CHIP } from "@/components/ui/badge"
import { MatchupBands } from "@/components/types/MatchupBands"
import { getMultiplier, matchupBands, TYPE_NAMES } from "@/lib/domain/typeChart"
import type { TypeName } from "@/lib/domain/types"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"

export type TypesSearch = {
  t?: string
  view?: string
}

function parseSelected(raw?: string): TypeName[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TypeName => TYPE_NAMES.includes(s as TypeName))
    .slice(0, 2)
}

function cellClass(mult: number): string {
  if (mult === 0) return "bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)]"
  if (mult === 0.5) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
  if (mult === 2) return "bg-red-500/25 text-red-600 dark:text-red-400"
  return "bg-transparent text-[var(--ds-gray-400)]"
}

function cellLabel(mult: number): string {
  if (mult === 0) return "0"
  if (mult === 0.5) return "½"
  if (mult === 2) return "2"
  return ""
}

export function TypesPage() {
  const search = useSearch({ strict: false }) as TypesSearch
  const navigate = useNavigate()
  const { t, typeName } = useI18n()
  const selected = parseSelected(search.t)
  const chart = search.view === "chart"
  const [hover, setHover] = React.useState<{ atk: TypeName; def: TypeName } | null>(null)

  const setSelected = (next: TypeName[]) => {
    navigate({
      to: "/types",
      search: {
        t: next.length ? next.join(",") : undefined,
        view: chart ? "chart" : undefined,
      } as never,
    })
  }

  const toggle = (tt: TypeName) => {
    if (selected.includes(tt)) setSelected(selected.filter((x) => x !== tt))
    else if (selected.length < 2) setSelected([...selected, tt])
    else setSelected([selected[0]!, tt])
  }

  const bands = matchupBands(selected.length ? selected : [])
  const showBands = selected.length > 0

  return (
    <div className="flex flex-col min-h-full">
      <div className="border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-6 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("types.title")}</h1>
            <p className="text-xs text-[var(--ds-gray-700)] mt-1 max-w-xl">{t("types.desc")}</p>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-[var(--ds-gray-400)] p-0.5">
            <button
              type="button"
              onClick={() => navigate({ to: "/types", search: { t: search.t, view: undefined } as never })}
              className={cn("h-7 px-2.5 rounded text-xs font-medium", !chart ? "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)]" : "text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)]")}
            >
              {t("types.viewBands")}
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/types", search: { t: search.t, view: "chart" } as never })}
              className={cn("h-7 px-2.5 rounded text-xs font-medium", chart ? "bg-[var(--ds-gray-100)] text-[var(--ds-gray-1000)]" : "text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)]")}
            >
              {t("types.viewChart")}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t("types.pick")}</h2>
            {selected.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                {t("dex.clear")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {TYPE_NAMES.map((tt) => {
              const on = selected.includes(tt)
              const chip = TYPE_CHIP[tt]!
              return (
                <button
                  key={tt}
                  type="button"
                  onClick={() => toggle(tt)}
                  aria-pressed={on}
                  className={cn(
                    "h-10 rounded-md border text-[12px] font-bold tracking-wide uppercase transition-all",
                    chip.solid,
                    on ? "ring-2 ring-[var(--ds-blue-700)] ring-offset-1 ring-offset-[var(--ds-background-100)] scale-[1.02]" : "opacity-90 hover:opacity-100 hover:brightness-110",
                  )}
                >
                  {typeName(tt)}
                </button>
              )
            })}
          </div>
        </section>

        {chart ? (
          <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-3 overflow-auto">
            <p className="text-xs text-[var(--ds-gray-700)] mb-2">{t("types.chartHint")}</p>
            {hover && (
              <p className="text-sm mb-2">
                <span className="font-medium">{typeName(hover.atk)}</span>
                <span className="text-[var(--ds-gray-700)]"> → </span>
                <span className="font-medium">{typeName(hover.def)}</span>
                <span className="ml-2 tnum font-semibold">
                  {getMultiplier(hover.atk, hover.def) === 0.5 ? "½×" : `${getMultiplier(hover.atk, hover.def)}×`}
                </span>
              </p>
            )}
            <table className="border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-[var(--ds-background-200)] w-8" />
                  {TYPE_NAMES.map((d) => (
                    <th key={d} className="p-0">
                      <Link
                        to="/types/$typeId"
                        params={{ typeId: d } as never}
                        className={cn("flex h-8 w-8 items-center justify-center rounded-sm font-bold", TYPE_CHIP[d]?.solid)}
                        title={typeName(d)}
                      >
                        {typeName(d).slice(0, 2)}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TYPE_NAMES.map((atk) => (
                  <tr key={atk}>
                    <th className="sticky left-0 bg-[var(--ds-background-200)] p-0">
                      <Link
                        to="/types/$typeId"
                        params={{ typeId: atk } as never}
                        className={cn("flex h-8 w-8 items-center justify-center rounded-sm font-bold", TYPE_CHIP[atk]?.solid)}
                        title={typeName(atk)}
                      >
                        {typeName(atk).slice(0, 2)}
                      </Link>
                    </th>
                    {TYPE_NAMES.map((def) => {
                      const m = getMultiplier(atk, def)
                      const hi = hover && (hover.atk === atk || hover.def === def)
                      return (
                        <td
                          key={def}
                          onMouseEnter={() => setHover({ atk, def })}
                          className={cn("h-8 w-8 text-center tnum font-semibold rounded-sm", cellClass(m), hi && "outline outline-1 outline-[var(--ds-blue-700)]")}
                        >
                          {cellLabel(m)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
            <h2 className="text-sm font-semibold mb-1">{t("types.defense")}</h2>
            <p className="text-xs text-[var(--ds-gray-700)] mb-3">
              {showBands
                ? selected.map((tt) => typeName(tt)).join(" / ")
                : t("types.pickHint")}
            </p>
            {showBands ? <MatchupBands bands={bands} /> : <p className="text-sm text-[var(--ds-gray-700)]">{t("types.pickHint")}</p>}
            {selected.length === 1 && (
              <Link
                to="/types/$typeId"
                params={{ typeId: selected[0]! } as never}
                className="inline-block mt-4 text-sm text-[var(--ds-blue-700)] hover:underline font-medium"
              >
                {t("types.openHub")} →
              </Link>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
