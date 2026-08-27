import * as React from "react"
import { useParams, useRouter, useSearch } from "@tanstack/react-router"
import { useDataset } from "@/hooks/useDataset"
import { Badge, LinkedTypeBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HelpTip } from "@/components/ui/helptip"
import { calcBST } from "@/lib/utils"
import { useI18n } from "@/lib/i18n"
import { defensiveProfile as calcDef, weaknesses, resistances, immunities } from "@/lib/domain/typeChart"
import { Sprite } from "@/components/ui/sprite"
import { SetCard } from "@/components/sets/SetCard"
import { FormFamily } from "@/components/forms/FormFamily"

function fmtMult(v: number, pt: boolean): string {
  const s = v === 0 ? "0" : String(v)
  return `${pt ? s.replace(".", ",") : s}×`
}

export function FormDetailPage() {
  const { formId } = useParams({ strict: false }) as { formId: string }
  const router = useRouter()
  const { t, lang, typeName } = useI18n()
  const { data, loading } = useDataset()
  const search = useSearch({ from: "/form/$formId" })
  const activeTab: "stats" | "sets" = search.tab === "sets" ? "sets" : "stats"
  const [filterGen, setFilterGen] = React.useState<string>("all")
  const [filterFmt, setFilterFmt] = React.useState<string>("all")

  // Deep-linkable tab: /form/<id>?tab=sets opens straight on Sets. Router-managed
  // so the history entry keeps its state (needed for scroll restoration).
  const switchTab = React.useCallback(
    (tab: "stats" | "sets") => {
      void router.navigate({
        to: "/form/$formId",
        params: { formId },
        search: { tab: tab === "sets" ? ("sets" as const) : undefined },
        replace: true,
      })
    },
    [router, formId],
  )

  const handleBack = React.useCallback(() => {
    if (window.history.length > 1) router.history.back()
    else router.navigate({ to: "/" })
  }, [router])

  if (loading || !data) return <div className="p-8 text-sm text-[var(--ds-gray-700)]">{t("detail.loading")}</div>

  const form = data.formsById.get(formId)
  if (!form) {
    return (
      <div className="p-8 space-y-3">
        <Button variant="outline" size="sm" onClick={handleBack}>
          {t("detail.back")}
        </Button>
        <div className="rounded-md border border-[var(--ds-red-700)] bg-[var(--ds-background-200)] p-4 text-sm">
          Form <code>{formId}</code> {t("detail.notFound")}
          <div className="text-xs text-[var(--ds-gray-700)] mt-1">{t("detail.slugHint")}</div>
        </div>
      </div>
    )
  }

  const species = data.speciesById.get(form.speciesId)
  const bst = calcBST(form.baseStats)
  const def = calcDef(form.types as unknown as string[] as never)
  const weaks = weaknesses(def as never)
  const resists = resistances(def as never)
  const immuns = immunities(def as never)

  const sets = data.sets.sets.filter((s) => s.formId === form.id)
  const gens = [...new Set(sets.map((s) => s.dexGen))].sort()
  const fmts = [...new Set(sets.map((s) => s.formatId))].sort()
  const filteredSets = sets.filter((s) => {
    if (filterGen !== "all" && s.dexGen !== filterGen) return false
    if (filterFmt !== "all" && s.formatId !== filterFmt) return false
    return true
  })

  return (
    <div className="flex flex-col">
      <div className="border-b border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-6 py-4">
        <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-2 mb-2">
          {t("detail.back")}
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-[var(--ds-gray-700)]">
              #{String(form.speciesId).padStart(4, "0")} • {species?.name ?? "—"} {form.isBaseForm ? "" : "• Form"}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{form.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              {form.types.map((tt) => (
                <LinkedTypeBadge key={tt} type={tt} />
              ))}
              {form.tier && <Badge className="min-w-[64px] justify-center">Tier {form.tier}</Badge>}
              {form.traits.length > 0 && <Badge>{form.traits.join(" • ")}</Badge>}
              <span className="text-xs text-[var(--ds-gray-700)] font-mono">{form.id}</span>
            </div>
          </div>
          <div className="shrink-0 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-3 text-center min-w-[120px] flex flex-col items-center gap-1">
            <Sprite form={form} size="md" />
            <div className="text-xs text-[var(--ds-gray-700)] flex items-center gap-1">BST <HelpTip text={t("glossary.bst")} /></div>
            <div className="text-2xl font-semibold tnum">{bst}</div>
            <div className="text-xs text-[var(--ds-gray-700)]">
              {form.baseStats.hp}/{form.baseStats.atk}/{form.baseStats.def}/{form.baseStats.spa}/{form.baseStats.spd}/{form.baseStats.spe}
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-1 border-b border-[var(--ds-gray-400)] -mb-px">
          <button onClick={() => switchTab("stats")} className={`px-3 py-2 text-sm border-b-2 ${activeTab === "stats" ? "border-[var(--ds-gray-1000)] font-medium" : "border-transparent text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)]"}`}>
            {t("detail.statsDefense")}
          </button>
          <button onClick={() => switchTab("sets")} className={`px-3 py-2 text-sm border-b-2 ${activeTab === "sets" ? "border-[var(--ds-gray-1000)] font-medium" : "border-transparent text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-1000)]"}`}>
            {t("detail.sets")} <span className="ml-1 text-xs bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] rounded px-1">{sets.length}</span>
          </button>
        </div>
      </div>

      <FormFamily form={form} data={data} />

      {activeTab === "stats" ? (
        <div className="p-6 space-y-6">
          <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
            <h2 className="text-sm font-semibold mb-3">{t("detail.baseStats")}</h2>
            <div className="space-y-2 max-w-lg">
              {(["hp", "atk", "def", "spa", "spd", "spe"] as const).map((k) => {
                const v = form.baseStats[k]
                const pct = Math.min(100, (v / 255) * 100)
                return (
                  <div key={k} className="grid grid-cols-[40px_36px_1fr_36px] items-center gap-2 text-sm">
                    <span className="text-[var(--ds-gray-700)] uppercase text-xs">{k}</span>
                    <span className="tnum font-medium text-right">{v}</span>
                    <div className="h-2 rounded bg-[var(--ds-gray-100)] border border-[var(--ds-gray-400)] overflow-hidden">
                      <div className="h-full bg-[var(--ds-gray-1000)]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-[var(--ds-gray-700)]">{pct.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-xs text-[var(--ds-gray-700)]">{t("detail.abilities")} {form.abilities.slot0}{form.abilities.slot1 ? ` / ${form.abilities.slot1}` : ""}{form.abilities.hidden ? ` (H: ${form.abilities.hidden})` : ""}</div>
          </section>

          <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
            <h2 className="text-sm font-semibold mb-3">{t("detail.defensiveProfile")}</h2>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium text-[var(--ds-red-700)] mb-1">{t("detail.weaknesses")} {weaks.length}</div>
                <div className="flex flex-wrap gap-1">
                  {weaks.length ? weaks.map((tt) => <LinkedTypeBadge key={tt} type={tt} />) : <span className="text-[var(--ds-gray-700)]">—</span>}
                </div>
              </div>
              <div>
                <div className="font-medium text-[var(--ds-green-700)] mb-1">{t("detail.resistances")} {resists.length}</div>
                <div className="flex flex-wrap gap-1">
                  {resists.length ? resists.map((tt) => <LinkedTypeBadge key={tt} type={tt} />) : <span className="text-[var(--ds-gray-700)]">—</span>}
                </div>
              </div>
              <div>
                <div className="font-medium text-[var(--ds-gray-700)] mb-1">{t("detail.immunities")} {immuns.length}</div>
                <div className="flex flex-wrap gap-1">
                  {immuns.length ? immuns.map((tt) => <LinkedTypeBadge key={tt} type={tt} />) : <span className="text-[var(--ds-gray-700)]">—</span>}
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-[var(--ds-gray-700)] mb-2">{t("detail.gridCaption")}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
              {Object.entries(def).map(([atk, mult]) => {
                const cell =
                  mult === 0
                    ? "bg-[var(--ds-gray-100)] border-[var(--ds-gray-400)]"
                    : mult > 1
                      ? "bg-red-950/30 border-red-900"
                      : mult < 1
                        ? "bg-green-950/30 border-green-900"
                        : "bg-transparent border-[var(--ds-gray-200)]"
                const num = mult === 0 ? "text-[var(--ds-gray-700)]" : mult > 1 ? "text-red-400" : mult < 1 ? "text-green-400" : "text-[var(--ds-gray-700)] opacity-60"
                return (
                  <div key={atk} className={`flex items-center justify-between gap-1 rounded border px-1.5 py-1 ${cell}`} title={`${typeName(atk)}: ${fmtMult(mult, lang === "pt-BR")}`}>
                    <LinkedTypeBadge type={atk} className="h-[18px] text-[10px]" />
                    <span className={`tnum text-[11px] font-semibold ${num}`}>{fmtMult(mult, lang === "pt-BR")}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      ) : (
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <select value={filterGen} onChange={(e) => setFilterGen(e.target.value)} className="h-8 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm">
              <option value="all">{t("detail.allGens")} ({gens.length})</option>
              {gens.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select value={filterFmt} onChange={(e) => setFilterFmt(e.target.value)} className="h-8 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm">
              <option value="all">{t("detail.allFormats")} ({fmts.length})</option>
              {fmts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--ds-gray-700)] self-center ml-2">{filteredSets.length} {t("detail.setsCount")}</span>
          </div>
          {filteredSets.length === 0 ? (
            <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-8 text-center text-sm text-[var(--ds-gray-700)]">{t("detail.noSets")}</div>
          ) : (
            <div className="grid gap-3">
              {filteredSets.slice(0, 60).map((s) => (
                <SetCard key={`${s.dexGen}-${s.formatId}-${s.name}`} set={s} form={form} data={data} />
              ))}
              {filteredSets.length > 60 && <div className="text-xs text-[var(--ds-gray-700)] text-center">{t("detail.showing")} 60 {t("detail.of")} {filteredSets.length}. {t("detail.refine")}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
