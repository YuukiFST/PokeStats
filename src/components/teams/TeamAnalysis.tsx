import * as React from "react"
import { Link } from "@tanstack/react-router"
import { LinkedTypeBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HelpTip } from "@/components/ui/helptip"
import { PinIcon, SwapIcon, LockIcon } from "@/components/ui/icons"
import { SpriteThumb } from "@/components/ui/sprite"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import { calcBST, cn, STAT_LABEL } from "@/lib/utils"
import { defensiveProfile, offensiveCoverage, TYPE_NAMES } from "@/lib/domain/typeChart"
import type { BaseStatSpread, Form, FormId, StatKey, TypeName } from "@/lib/domain/types"
import type { LoadedDataset } from "@/lib/dataset/load"
import {
  SUGGESTIONS_LIMIT,
  bestSwapTargets,
  suggestImprovementPlan,
  suggestTeamAdditions,
  type ImprovementPlan,
  type SuggestionReason,
  type SuggestionsResult,
  type SwapTarget,
  type TraitFilterOption,
} from "@/lib/domain/recommend"

interface Props {
  members: Form[]
  ptBR: boolean
  data?: LoadedDataset | null
  /** Adds a suggested Form to the first empty slot; omit when the Team is full. */
  onAddMember?: (formId: string) => void
  /** Swaps the suggested Form into the slot held by replaceMemberId; omit while empty slots exist. */
  onReplaceMember?: (formId: string, replaceMemberId: string) => void
  /** FormIds the user locked against swap suggestions (favorites). */
  protectedMembers?: FormId[]
  onToggleProtect?: (formId: string) => void
  /** Applies a whole improvement plan atomically; omit while empty slots exist. */
  onApplyPlan?: (removeIds: string[], addIds: string[]) => void
  /** FormIds the user pinned in Membros Sugeridos; rendered first, immune to filters. */
  pinnedSuggestions?: FormId[]
  onTogglePin?: (formId: string) => void
}

const TRAIT_FILTER_OPTIONS = ["mega", "gmax", "primal", "regional", "battle-only", "none"] as const

function fmtMult(v: number, pt: boolean): string {
  const s = v === 0 ? "0" : String(v)
  return `${pt ? s.replace(".", ",") : s}×`
}

function multCellClass(m: number): string {
  if (m === 0) return "bg-[var(--ds-gray-100)] text-[var(--ds-gray-700)]"
  if (m >= 2) return "bg-red-950/40 text-red-400"
  if (m > 1) return "bg-red-950/20 text-red-300/90"
  if (m < 1) return "bg-green-950/30 text-green-400"
  return "text-[var(--ds-gray-700)] opacity-40"
}

/** Metric gain, pt-BR style decimal when requested: +12,3 / −0,8. */
function fmtGain(delta: number, pt: boolean): string {
  const sign = delta < 0 ? "−" : "+"
  const s = Math.abs(delta).toFixed(1)
  return `${sign}${pt ? s.replace(".", ",") : s}`
}

function RefreshIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

const REASON_CHIP: Record<SuggestionReason["kind"], string> = {
  resist: "border-[var(--ds-gray-400)] bg-transparent text-[var(--ds-gray-900)]",
  immune: "border-[var(--ds-blue-700)] bg-[var(--ds-blue-700)]/15 text-[var(--ds-blue-700)] font-semibold",
  cover: "border-green-900 bg-green-950/30 text-green-400",
  risk: "border-red-900 bg-red-950/30 text-red-400 line-through decoration-1",
}

/**
 * Aggregated team view: snapshot chips, shared weaknesses, defense matrix
 * (every member × every attacking Type), offensive coverage and structural
 * warnings (holes = nobody resists; redundancy = 3+ weak to the same Type).
 */
export function TeamAnalysis({
  members,
  ptBR,
  data,
  onAddMember,
  onReplaceMember,
  protectedMembers,
  onToggleProtect,
  onApplyPlan,
  pinnedSuggestions,
  onTogglePin,
}: Props) {
  const { t, typeName } = useI18n()

  const [minBst, setMinBst] = React.useState(500)
  const [minStats, setMinStats] = React.useState<Partial<BaseStatSpread>>({})
  const [allowedTraits, setAllowedTraits] = React.useState<Set<TraitFilterOption>>(
    () => new Set(TRAIT_FILTER_OPTIONS),
  )

  const toggleTraitFilter = (tr: TraitFilterOption) =>
    setAllowedTraits((prev) => {
      const next = new Set(prev)
      if (!next.delete(tr)) next.add(tr)
      return next
    })

  // "Next batch" window; resets to the top batch whenever an input shaping the ranking changes.
  const filterKey = `${members.map((m) => m.id).join(",")}|${minBst}|${(Object.keys(STAT_LABEL) as StatKey[])
    .map((k) => `${k}:${minStats[k] ?? 0}`)
    .join(",")}|${[...allowedTraits].sort().join(",")}`
  const [page, setPage] = React.useState(0)
  const [seenFilterKey, setSeenFilterKey] = React.useState(filterKey)
  if (seenFilterKey !== filterKey) {
    setSeenFilterKey(filterKey)
    setPage(0)
  }

  const pinnedSet = React.useMemo(() => new Set(pinnedSuggestions ?? []), [pinnedSuggestions])

  const profiles = React.useMemo(
    () => members.map((m) => ({ form: m, def: defensiveProfile(m.types as unknown as TypeName[]) })),
    [members],
  )

  const suggestions = React.useMemo<SuggestionsResult>(() => {
    if (!data || members.length === 0 || !data.extrasReady) return { items: [], rankedPoolSize: 0, rankedPool: [] }
    const formsWithSets = new Set(data.sets.sets.map((s) => s.formId))
    return suggestTeamAdditions(members, data.core.forms as Form[], {
      formsWithSets,
      filters: { minBst, minStats, allowedTraits },
      pinnedIds: pinnedSet,
      offset: page,
    })
  }, [members, data, minBst, minStats, allowedTraits, pinnedSet, page])

  const protectedSet = React.useMemo(() => new Set(protectedMembers ?? []), [protectedMembers])

  const fillSlots = Math.max(0, SUGGESTIONS_LIMIT - suggestions.items.filter((s) => pinnedSet.has(s.form.id)).length)
  const hasMorePages = fillSlots > 0 && suggestions.rankedPoolSize > fillSlots

  // Swap targets only matter when the parent can swap (full Team); otherwise the "+" adds.
  // Protected members are never proposed as targets.
  const swapTargets = React.useMemo(() => {
    if (!onReplaceMember || suggestions.items.length === 0) return new Map<string, SwapTarget>()
    return bestSwapTargets(members, suggestions.items.map((s) => s.form), { protectedIds: protectedSet })
  }, [members, suggestions.items, onReplaceMember, protectedSet])

  // Two-member upgrade around the locks; single swaps already live on the cards.
  const plan = React.useMemo<ImprovementPlan | null>(() => {
    if (!onApplyPlan || suggestions.rankedPool.length === 0) return null
    return suggestImprovementPlan(
      members,
      suggestions.rankedPool.map((s) => s.form),
      { protectedIds: protectedSet },
    )
  }, [members, suggestions.rankedPool, onApplyPlan, protectedSet])

  const { weaknessCounts, holes, redundant } = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { def } of profiles) {
      for (const atk of TYPE_NAMES) {
        if (def[atk]! > 1) counts[atk] = (counts[atk] ?? 0) + 1
      }
    }
    const holesOut = TYPE_NAMES.filter((atk) => profiles.every(({ def }) => def[atk]! >= 1))
    const redundantOut = TYPE_NAMES.filter((atk) => (counts[atk] ?? 0) >= 3)
    return { weaknessCounts: counts, holes: holesOut, redundant: redundantOut }
  }, [profiles])

  const coverage = React.useMemo(() => {
    const attackerTypes = [...new Set(members.flatMap((m) => m.types))] as TypeName[]
    return offensiveCoverage(attackerTypes as never)
  }, [members])

  const avgBst = Math.round(members.reduce((acc, m) => acc + calcBST(m.baseStats), 0) / members.length)
  const fastest = members.reduce((a, b) => (b.baseStats.spe > a.baseStats.spe ? b : a), members[0]!)

  return (
    <div className="space-y-4">
      {/* snapshot */}
      <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
        <h2 className="text-sm font-semibold mb-2">{t("analysis.summary")}</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-xs text-[var(--ds-gray-700)] block">{t("analysis.avgBst")}</span>
            <span className="tnum font-semibold">{avgBst}</span>
          </div>
          <div>
            <span className="text-xs text-[var(--ds-gray-700)] block">{t("analysis.fastest")}</span>
            <Link to="/form/$formId" params={{ formId: fastest.id } as never} className="font-medium hover:underline">
              {fastest.name} <span className="tnum text-xs text-[var(--ds-gray-700)]">({fastest.baseStats.spe})</span>
            </Link>
          </div>
          <div className="min-w-[180px] flex-1">
            <span className="text-xs text-[var(--ds-gray-700)] block">{t("analysis.holes")}</span>
            {holes.length ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {holes.map((tt) => (
                  <LinkedTypeBadge key={tt} type={tt} />
                ))}
              </div>
            ) : (
              <span className="text-xs">—</span>
            )}
          </div>
          <div className="min-w-[180px] flex-1">
            <span className="text-xs text-[var(--ds-gray-700)] block">{t("analysis.redundancy")}</span>
            {redundant.length ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {redundant.map((tt) => (
                  <LinkedTypeBadge key={tt} type={tt} />
                ))}
              </div>
            ) : (
              <span className="text-xs">—</span>
            )}
          </div>
        </div>
      </div>

      {/* defense matrix */}
      <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
        <h2 className="text-sm font-semibold mb-1">
          {t("analysis.matrix")} <HelpTip text={t("analysis.matrixCaption")} />
        </h2>
        <div className="flex flex-wrap gap-3 mb-3 text-[11px] text-[var(--ds-gray-700)]">
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1 align-middle" />{t("legend.weak")}</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1 align-middle" />{t("legend.resist")}</span>
          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--ds-gray-400)] mr-1 align-middle" />{t("legend.immune")}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-[var(--ds-background-200)] text-left pr-2 pb-1 min-w-[76px]" />
                {profiles.map(({ form }) => (
                  <th key={form.id} className="px-1 pb-1" title={form.name}>
                    <div className="flex flex-col items-center gap-0.5">
                      <SpriteThumb form={form} expandable={false} />
                      {protectedSet.has(form.id) && onToggleProtect && (
                        <button
                          onClick={() => onToggleProtect(form.id)}
                          aria-label={`${t("analysis.unprotect")}: ${form.name}`}
                          title={`${t("analysis.unprotect")}: ${form.name}`}
                          className="text-[var(--ds-blue-700)] hover:text-[var(--ds-gray-900)]"
                        >
                          <LockIcon />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TYPE_NAMES.map((atk) => (
                <tr key={atk}>
                  <td className="sticky left-0 bg-[var(--ds-background-200)] pr-2 py-0.5">
                    <LinkedTypeBadge type={atk} className="h-[18px] text-[10px]" />
                  </td>
                  {profiles.map(({ form, def }) => {
                    const m = def[atk]!
                    return (
                      <td key={form.id} className={`tnum text-center px-1.5 py-0.5 rounded ${multCellClass(m)}`} title={`${form.name}: ${fmtMult(m, ptBR)} ${typeName(atk)}`}>
                        {fmtMult(m, ptBR)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-[var(--ds-gray-700)]">
          {Object.keys(weaknessCounts).length ? t("teams.defensiveHint") : ""}
        </div>
      </div>

      {/* offensive coverage */}
      <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
        <h2 className="text-sm font-semibold mb-2">{t("teams.offensive")}</h2>
        <div className="flex flex-wrap gap-1">
          {coverage.superEffective.length ? coverage.superEffective.map((tt) => <LinkedTypeBadge key={String(tt)} type={String(tt)} />) : <span className="text-xs text-[var(--ds-gray-700)]">—</span>}
        </div>
        <div className="text-xs text-[var(--ds-gray-700)] mt-2">
          {t("teams.noEffect")} {coverage.noEffect.length ? coverage.noEffect.map(typeName).join(", ") : "—"}
        </div>
      </div>

      {/* smart suggestions */}
      {data && members.length > 0 && (
        <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-1.5">
            {t("analysis.suggested")}
            <HelpTip text={t("analysis.suggestedHelp")} />
          </h2>
          <p className="text-xs text-[var(--ds-gray-700)] mb-3">{t("analysis.suggestedDesc")}</p>
          {!data.extrasReady ? (
            <p className="text-xs text-[var(--ds-gray-700)]">{t("detail.loading")}</p>
          ) : (
          <>
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-[var(--ds-gray-700)]">BST ≥</span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={minBst || ""}
                onChange={(e) => setMinBst(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="h-8 w-[72px] rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm tnum"
              />
            </label>
            {(Object.keys(STAT_LABEL) as StatKey[]).map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-[10px] text-[var(--ds-gray-700)]">{STAT_LABEL[k]} ≥</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  placeholder="—"
                  value={minStats[k] ?? ""}
                  onChange={(e) => {
                    const v = Math.min(255, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                    setMinStats((prev) => ({ ...prev, [k]: v > 0 ? v : undefined }))
                  }}
                  className="h-8 w-[64px] rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm tnum"
                />
              </label>
            ))}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-[var(--ds-gray-700)] flex items-center gap-1">
                {t("analysis.traitFilter")} <HelpTip text={t("analysis.traitFilterHelp")} />
              </span>
              <div className="flex flex-wrap gap-1">
                {TRAIT_FILTER_OPTIONS.map((tr) => {
                  const active = allowedTraits.has(tr)
                  return (
                    <button
                      key={tr}
                      onClick={() => toggleTraitFilter(tr)}
                      aria-pressed={active}
                      className={`h-8 rounded-md px-2 text-[11px] font-medium border transition-colors ${active ? "bg-[var(--ds-blue-700)] text-white border-[var(--ds-blue-700)]" : "bg-[var(--ds-background-100)] border-[var(--ds-gray-400)] text-[var(--ds-gray-900)] hover:bg-[var(--ds-gray-100)]"}`}
                    >
                      {t(`trait.${tr}` as TranslationKey)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          {suggestions.items.length ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {suggestions.items.map(({ form, reasons }) => {
                const pinned = pinnedSuggestions?.includes(form.id) ?? false
                const swap = swapTargets.get(form.id)
                const replaced = swap ? members.find((m) => m.id === swap.memberId) : undefined
                return (
                <div key={form.id} className={cn("rounded-md bg-[var(--ds-background-100)] p-2 flex gap-2 min-w-0 border", pinned ? "border-[var(--ds-blue-700)] ring-1 ring-[var(--ds-blue-700)]" : "border-[var(--ds-gray-300)]")}>
                <SpriteThumb form={form} expandable={false} />
                <div className="min-w-0 flex-1">
                  <Link to="/form/$formId" params={{ formId: form.id } as never} className="font-medium text-sm truncate block hover:underline">
                    {form.name}
                  </Link>
                  <div className="flex gap-1 mt-0.5">
                    {(form.types as string[]).map((tt) => (
                      <LinkedTypeBadge key={tt} type={tt} className="h-[16px] text-[9px]" />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {reasons
                      .filter((r) => r.kind !== "risk")
                      .slice(0, 4)
                      .map((r, i) => (
                        <span key={`${r.kind}-${r.type}-${i}`} className={cn("inline-flex items-center rounded border px-1 py-px text-[10px]", REASON_CHIP[r.kind])}>
                          {t(`rec.${r.kind}` as TranslationKey)} {typeName(r.type)}
                        </span>
                      ))}
                    {reasons
                      .filter((r) => r.kind === "risk")
                      .slice(0, 2)
                      .map((r, i) => (
                        <span key={`risk-${i}`} className={cn("inline-flex items-center rounded border px-1 py-px text-[10px]", REASON_CHIP.risk)}>
                          −{typeName(r.type)}
                        </span>
                      ))}
                  </div>
                  {swap && replaced && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--ds-gray-700)] min-w-0">
                      <SwapIcon />
                      <span className="truncate">
                        {t("analysis.swapWith")}{" "}
                        <Link to="/form/$formId" params={{ formId: replaced.id } as never} className="font-medium hover:underline">
                          {replaced.name}
                        </Link>
                      </span>
                      <span className={cn("tnum ml-auto shrink-0 font-medium", swap.delta >= 0 ? "text-green-400" : "text-red-400")}>
                        {fmtGain(swap.delta, ptBR)}
                      </span>
                      {onToggleProtect && (
                        <button
                          onClick={() => onToggleProtect(swap.memberId)}
                          aria-label={`${t("analysis.protect")}: ${replaced.name}`}
                          title={`${t("analysis.protect")}: ${replaced.name}`}
                          className="shrink-0 text-[var(--ds-gray-700)] hover:text-[var(--ds-gray-900)]"
                        >
                          <LockIcon />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="self-center shrink-0 flex flex-col gap-1">
                  {onTogglePin && (
                    <button
                      onClick={() => onTogglePin(form.id)}
                      aria-pressed={pinned}
                      aria-label={pinned ? t("analysis.unpin") : t("analysis.pin")}
                      title={pinned ? t("analysis.unpin") : t("analysis.pin")}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${pinned ? "border-[var(--ds-blue-700)] bg-[var(--ds-blue-700)]/15 text-[var(--ds-blue-700)]" : "border-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-900)]"}`}
                    >
                      <PinIcon filled={pinned} />
                    </button>
                  )}
                  {onReplaceMember && swap && replaced ? (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={t("analysis.swapAction")}
                      title={`${t("analysis.swapWith")} ${replaced.name}`}
                      onClick={() => onReplaceMember(form.id, swap.memberId)}
                    >
                      <SwapIcon />
                    </Button>
                  ) : onAddMember ? (
                    <Button size="sm" variant="outline" onClick={() => onAddMember(form.id)}>
                      +
                    </Button>
                  ) : null}
                </div>
              </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--ds-gray-700)]">{t("analysis.noMatches")}</p>
          )}
          {plan && (
            <div className="mt-3 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-2">
              <div className="flex items-center gap-1 mb-1.5 text-xs font-semibold">
                {t("analysis.plan")}
                <HelpTip text={t("analysis.planHelp")} />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span className="text-[var(--ds-gray-700)]">{t("analysis.planOut")}</span>
                {plan.removeIds.map((id) => {
                  const removed = members.find((m) => m.id === id)
                  return removed ? (
                    <span key={id} className="inline-flex items-center gap-0.5 line-through decoration-1 opacity-75">
                      <SpriteThumb form={removed} expandable={false} />
                      {removed.name}
                    </span>
                  ) : null
                })}
                <span className="text-[var(--ds-gray-700)]">{t("analysis.planFor")}</span>
                {plan.addIds.map((id) => {
                  const added = suggestions.rankedPool.find((s) => s.form.id === id)?.form
                  return added ? (
                    <span key={id} className="inline-flex items-center gap-0.5">
                      <SpriteThumb form={added} expandable={false} />
                      {added.name}
                    </span>
                  ) : null
                })}
                <span className="tnum font-medium text-green-400">{fmtGain(plan.delta, ptBR)}</span>
                <Button size="sm" variant="outline" onClick={() => onApplyPlan?.(plan.removeIds, plan.addIds)}>
                  {t("analysis.planApply")}
                </Button>
              </div>
            </div>
          )}
          {hasMorePages && (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPage((p) => p + 1)}>
                <RefreshIcon />
                {t("analysis.moreSuggestions")}
              </Button>
            </div>
          )}
          </>
          )}
        </div>
      )}
    </div>
  )
}
