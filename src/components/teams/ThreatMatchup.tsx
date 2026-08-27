import * as React from "react"
import { Link } from "@tanstack/react-router"
import { LinkedTypeBadge, TypeBadge, TYPE_CHIP } from "@/components/ui/badge"
import { HelpTip } from "@/components/ui/helptip"
import { PinIcon, RotateIcon } from "@/components/ui/icons"
import { Sprite, SpriteThumb } from "@/components/ui/sprite"
import { useI18n, type TranslationKey } from "@/lib/i18n"
import { calcBST, cn } from "@/lib/utils"
import { recommendAttackTypes, memberMatchup } from "@/lib/domain/matchup"
import { suggestCounters } from "@/lib/domain/recommend"
import { buildSmartCounterIndex, suggestSmartCounters, type SmartFormSuggestion } from "@/lib/domain/smartCounters"
import { TYPE_NAMES } from "@/lib/domain/typeChart"
import type { LoadedDataset } from "@/lib/dataset/load"
import type { Form, Team, TypeName } from "@/lib/domain/types"

export type CounterMode = "dataset" | "smart"

interface Props {
  team: Team
  members: Form[]
  data: LoadedDataset
  ptBR: boolean
  onChange: (opponents: string[]) => void
  /** Controlled via URL ?mode= so Back from a counter's detail page rebuilds the exact view. */
  counterMode: CounterMode
  onCounterModeChange: (mode: CounterMode) => void
}

const VERDICT_CHIP: Record<string, string> = {
  excellent: "bg-green-700 text-white border-green-700",
  good: "bg-green-700/20 text-green-400 border-green-700/50",
  neutral: "bg-transparent text-[var(--ds-gray-700)] border-[var(--ds-gray-400)]",
  bad: "bg-amber-500/15 text-amber-500 border-amber-600/50",
  none: "bg-red-950/40 text-red-400 border-red-900",
}

function fmtMult(v: number, pt: boolean): string {
  const s = v === 0 ? "0" : String(v)
  return `${pt ? s.replace(".", ",") : s}×`
}

/** Chip labels for Smart reasons: walls/carries as type arrows, outspeed as Spe, frail hidden. */
function smartChipLabels(reasons: SmartFormSuggestion["reasons"], typeName: (t: string) => string): string[] {
  return reasons
    .filter((r) => r.kind !== "frail")
    .slice(0, 2)
    .map((r) => (r.kind === "outspeed" ? "» Spe" : `${r.kind === "carries" ? "→" : "←"} ${typeName(r.type)}`))
}

function CounterCard({
  form,
  caption,
  bst,
  pinned,
  onPin,
  children,
}: {
  form: Form
  caption: string
  bst: number
  pinned: boolean
  onPin: (formId: string) => void
  children?: React.ReactNode
}) {
  const { t } = useI18n()
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-md border bg-[var(--ds-background-100)] px-2 py-1.5 transition-colors min-w-0",
        pinned ? "border-[var(--ds-blue-700)] ring-1 ring-[var(--ds-blue-700)]" : "border-[var(--ds-gray-300)]",
      )}
    >
      <Link
        to="/form/$formId"
        params={{ formId: form.id } as never}
        className="group flex items-center gap-2 flex-1 min-w-0"
      >
        <SpriteThumb form={form} expandable={false} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-medium group-hover:underline">{form.name}</span>
            <span className="tnum shrink-0 text-[10px] text-[var(--ds-gray-700)]">BST {bst}</span>
          </span>
          <span className="block truncate text-[10px] text-[var(--ds-gray-700)]">{caption}</span>
          {children}
        </span>
      </Link>
      <button
        onClick={() => onPin(form.id)}
        aria-pressed={pinned}
        aria-label={pinned ? t("matchup.unpinCounter") : t("matchup.pinCounter")}
        title={pinned ? t("matchup.unpinCounter") : t("matchup.pinCounter")}
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
          pinned
            ? "border-[var(--ds-blue-700)] bg-[var(--ds-blue-700)]/15 text-[var(--ds-blue-700)]"
            : "border-transparent text-[var(--ds-gray-700)] hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-900)]",
        )}
      >
        <PinIcon filled={pinned} />
      </button>
    </div>
  )
}

/**
 * Threat Matchup simulator: pick opposing Forms and see, per member,
 * who hits hard (STAB proxy), which attack Types are recommended or wasted,
 * and what the opponent threatens back. Extra attacker Types are optional.
 */
export function ThreatMatchup({ team, members, data, ptBR, onChange, counterMode, onCounterModeChange }: Props) {
  const { t, typeName } = useI18n()
  const [query, setQuery] = React.useState("")
  const [extraTypes, setExtraTypes] = React.useState<Set<TypeName>>(new Set())
  /** Pinned counter FormIds per opponent (local, beta): pinned cards render first and survive rotation. */
  const [pinnedCounters, setPinnedCounters] = React.useState<Map<string, Set<string>>>(new Map())
  /** Ranked-window index per opponent ("rotate" button cycles other candidates in). */
  const [counterOffset, setCounterOffset] = React.useState<Map<string, number>>(new Map())

  const togglePin = (oppId: string, formId: string) => {
    setPinnedCounters((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(oppId) ?? [])
      if (set.has(formId)) set.delete(formId)
      else set.add(formId)
      next.set(oppId, set)
      return next
    })
  }

  const rotateCounters = (oppId: string) => {
    setCounterOffset((prev) => {
      const next = new Map(prev)
      next.set(oppId, (next.get(oppId) ?? 0) + 1)
      return next
    })
  }

  const smartIndex = React.useMemo(
    () => buildSmartCounterIndex(data.core.forms as Form[], data.sets.sets, data.movesByName, data.naturesByName),
    [data],
  )

  const opponents = React.useMemo(
    () => (team.opponents ?? []).map((id) => data.formsById.get(id)).filter(Boolean) as Form[],
    [team.opponents, data],
  )
  const oppIds = React.useMemo(() => new Set(opponents.map((o) => o.id)), [opponents])

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return (data.core.forms as Form[])
      .filter((f) => f.name.toLowerCase().includes(q) || f.id.includes(q))
      .slice(0, 30)
  }, [query, data])

  const addOpponent = (id: string) => {
    if (oppIds.has(id)) return
    onChange([...(team.opponents ?? []), id])
    setQuery("")
  }

  const removeOpponent = (id: string) => onChange((team.opponents ?? []).filter((o) => o !== id))

  const toggleExtra = (tt: TypeName) => {
    const next = new Set(extraTypes)
    if (next.has(tt)) next.delete(tt)
    else next.add(tt)
    setExtraTypes(next)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-tight text-[var(--ds-gray-700)] max-w-[680px]">
        {t("matchup.desc")} <HelpTip text={t("matchup.proxyNote")} />
      </p>

      {/* opponent search */}
      <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4 space-y-3">
        <div className="text-xs font-medium">{t("matchup.opponents")}</div>
        <input
          placeholder={t("matchup.addPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-8 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-2 text-sm"
        />
        {query && (
          <div className="grid gap-1 max-h-56 overflow-auto rounded-md border border-[var(--ds-gray-400)] p-1 bg-[var(--ds-background-100)]">
            {results.map((f) => {
              const dup = oppIds.has(f.id)
              return (
                <button
                  key={f.id}
                  disabled={dup}
                  className="text-left flex items-center gap-2 rounded px-2 py-1 text-sm enabled:hover:bg-[var(--ds-gray-100)] disabled:opacity-45 disabled:cursor-not-allowed"
                  onClick={() => addOpponent(f.id)}
                >
                  <SpriteThumb form={f} expandable={false} />
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="flex gap-1 shrink-0">
                    {(f.types as string[]).map((tt) => (
                      <TypeBadge key={tt} type={tt} />
                    ))}
                  </span>
                </button>
              )
            })}
            {results.length === 0 && <div className="text-xs text-[var(--ds-gray-700)] p-2">{t("teams.noResults")}</div>}
          </div>
        )}
        {opponents.length === 0 && <div className="text-xs text-[var(--ds-gray-700)]">{t("matchup.noOpponents")}</div>}
      </div>

      {/* counter mode: Dataset (type math) vs Smart (Sets, beta) */}
      {opponents.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--ds-gray-700)]">{t("matchup.counterMode")}</span>
          <div className="inline-flex rounded-md border border-[var(--ds-gray-400)] overflow-hidden">
            <button
              onClick={() => onCounterModeChange("dataset")}
              aria-pressed={counterMode === "dataset"}
              className={cn(
                "px-2.5 py-1 font-medium transition-colors",
                counterMode === "dataset"
                  ? "bg-[var(--ds-gray-1000)] text-[var(--ds-gray-100)]"
                  : "bg-[var(--ds-background-100)] hover:bg-[var(--ds-gray-100)]",
              )}
            >
              {t("matchup.counterModeDataset")}
            </button>
            <button
              onClick={() => onCounterModeChange("smart")}
              aria-pressed={counterMode === "smart"}
              className={cn(
                "px-2.5 py-1 font-medium transition-colors flex items-center gap-1.5",
                counterMode === "smart"
                  ? "bg-[var(--ds-gray-1000)] text-[var(--ds-gray-100)]"
                  : "bg-[var(--ds-background-100)] hover:bg-[var(--ds-gray-100)]",
              )}
            >
              {t("matchup.counterModeSmart")}
              <span className="rounded-sm bg-amber-500/15 px-1 py-px text-[9px] font-bold tracking-wider text-amber-500 border border-amber-600/50">
                {t("matchup.betaBadge")}
              </span>
            </button>
          </div>
          <HelpTip text={t(counterMode === "smart" ? "matchup.countersSmartHelp" : "matchup.countersHelp")} />
        </div>
      )}

      {/* per-opponent breakdown */}
      {opponents.map((opp) => {
        const { recommended, avoid } = recommendAttackTypes(opp.types as unknown as TypeName[])
        const matchups = members.map((m) => memberMatchup(m.types as unknown as TypeName[], opp.types as unknown as TypeName[], m.id))
        const edgeCount = matchups.filter((mm) => mm.bestStabMult >= 2).length
        const excludeIds = new Set([...members.map((m) => m.id), ...opponents.map((o) => o.id)])
        const pins = pinnedCounters.get(opp.id)
        const windowOpts = { offset: counterOffset.get(opp.id) ?? 0, pinnedIds: pins }
        const datasetCounters =
          counterMode === "dataset"
            ? suggestCounters(opp.types as unknown as TypeName[], data.core.forms as Form[], excludeIds, windowOpts)
            : null
        const smartCounters =
          counterMode === "smart"
            ? suggestSmartCounters(opp, smartIndex, data.core.forms as Form[], excludeIds, windowOpts)
            : null
        return (
          <div key={opp.id} className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Sprite form={opp} size="sm" />
              <div className="min-w-0">
                <Link to="/form/$formId" params={{ formId: opp.id } as never} className="font-semibold text-sm hover:underline block truncate">
                  {opp.name}
                </Link>
                <div className="flex gap-1 mt-0.5">
                  {(opp.types as string[]).map((tt) => (
                    <LinkedTypeBadge key={tt} type={tt} />
                  ))}
                </div>
              </div>
              <button onClick={() => removeOpponent(opp.id)} className="ml-auto text-xs text-[var(--ds-gray-700)] hover:text-[var(--ds-red-700)]" aria-label={t("teams.remove")}>
                ✕
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium mb-1.5 text-green-500">{t("matchup.recommended")}</div>
                <div className="flex flex-wrap gap-1">
                  {recommended.map((r) => (
                    <span
                      key={r.type}
                      title={`${typeName(r.type)}: ${fmtMult(r.mult, ptBR)}`}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold",
                        TYPE_CHIP[r.type]?.soft,
                        extraTypes.has(r.type) && "ring-2 ring-offset-1 ring-offset-[var(--ds-background-200)] ring-[var(--ds-gray-1000)]",
                      )}
                    >
                      <span className="uppercase tracking-wide">{typeName(r.type)}</span>
                      <span className="tnum font-normal opacity-80">{fmtMult(r.mult, ptBR)}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium mb-1.5 text-red-400">{t("matchup.avoid")}</div>
                <div className="flex flex-wrap gap-1 opacity-70">
                  {avoid.map((r) => (
                    <span
                      key={r.type}
                      title={`${typeName(r.type)}: ${fmtMult(r.mult, ptBR)}`}
                      className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", TYPE_CHIP[r.type]?.soft)}
                    >
                      <span className="uppercase tracking-wide line-through decoration-1">{typeName(r.type)}</span>
                      <span className="tnum font-normal opacity-80">{fmtMult(r.mult, ptBR)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium mb-1">
                {t("matchup.membersVs")} · <span className="font-normal text-[var(--ds-gray-700)]">{t("matchup.edge")}: {edgeCount}/{members.length}</span>
              </div>
              <div className="grid gap-1">
                {matchups.map((mm) => {
                  const member = members.find((m) => m.id === mm.formId)!
                  return (
                    <div key={mm.formId} className="grid grid-cols-[24px_1fr_auto_auto] sm:grid-cols-[24px_140px_92px_1fr] items-center gap-2 rounded border border-[var(--ds-gray-300)] bg-[var(--ds-background-100)] px-2 py-1">
                      <SpriteThumb form={member} expandable={false} />
                      <Link to="/form/$formId" params={{ formId: member.id } as never} className="text-sm truncate hover:underline hidden sm:block">
                        {member.name}
                      </Link>
                      <span className={`justify-self-start inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold w-max ${VERDICT_CHIP[mm.verdict]}`}>
                        {t(`verdict.${mm.verdict}` as TranslationKey)} <span className="tnum ml-1 opacity-75 font-normal">{fmtMult(mm.bestStabMult, ptBR)}</span>
                      </span>
                      <span className="justify-self-end text-right text-[11px] text-[var(--ds-gray-700)] truncate max-w-[220px]" title={mm.threats.map((th) => `${fmtMult(th.mult, ptBR)} ${th.types.map(typeName).join("/")}`).join(" • ")}>
                        {mm.threats.length
                          ? `${t("matchup.incoming")} ${mm.threats.map((th) => `${fmtMult(th.mult, ptBR)} ${th.types.map(typeName).join("/")}`).join(", ")}`
                          : ""}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-1 text-[11px] text-[var(--ds-gray-700)]">{t("matchup.proxyNote")}</div>
            </div>

            {/* suggested counters: Dataset (type math) or Smart (Sets, beta) */}
            {(datasetCounters?.length ?? smartCounters?.length ?? 0) > 0 && (
              <div>
                <div className="text-xs font-medium mb-1 flex items-center gap-1.5">
                  <span>
                    {counterMode === "smart" ? t("matchup.countersSmart") : t("matchup.counters")}
                  </span>
                  {counterMode === "smart" && (
                    <span className="rounded-sm bg-amber-500/15 px-1 py-px text-[9px] font-bold tracking-wider text-amber-500 border border-amber-600/50">
                      {t("matchup.betaBadge")}
                    </span>
                  )}
                  <span className="font-normal text-[var(--ds-gray-700)]">{t("matchup.countersBstNote")}</span>
                  <button
                    onClick={() => rotateCounters(opp.id)}
                    aria-label={t("matchup.rotateCounters")}
                    title={t("matchup.rotateCounters")}
                    className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[var(--ds-gray-700)] transition-colors hover:bg-[var(--ds-gray-100)] hover:text-[var(--ds-gray-900)]"
                  >
                    <RotateIcon />
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
                  {smartCounters?.map(({ form, reasons, noSets }) => (
                    <CounterCard
                      key={form.id}
                      form={form}
                      caption={smartChipLabels(reasons, typeName).join(" · ")}
                      bst={calcBST(form.baseStats)}
                      pinned={pins?.has(form.id) ?? false}
                      onPin={(formId) => togglePin(opp.id, formId)}
                    >
                      {noSets && (
                        <span className="block truncate text-[10px] text-[var(--ds-gray-700)] opacity-70">
                          {t("matchup.noSetsFallback")}
                        </span>
                      )}
                    </CounterCard>
                  ))}
                  {datasetCounters?.map(({ form, reasons }) => (
                    <CounterCard
                      key={form.id}
                      form={form}
                      caption={reasons
                        .filter((r) => r.kind !== "risk")
                        .slice(0, 2)
                        .map((r) => `${r.kind === "cover" ? "→" : "←"} ${typeName(r.type)}`)
                        .join(" · ")}
                      bst={calcBST(form.baseStats)}
                      pinned={pins?.has(form.id) ?? false}
                      onPin={(formId) => togglePin(opp.id, formId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* optional extra attacker types */}
      {opponents.length > 0 && (
        <div className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
          <div className="text-xs font-medium mb-1">{t("matchup.custom")}</div>
          <div className="text-[11px] text-[var(--ds-gray-700)] mb-2">{t("matchup.customHint")}</div>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_NAMES.map((tt) => {
              const active = extraTypes.has(tt)
              const chip = TYPE_CHIP[tt]!
              return (
                <button
                  key={tt}
                  onClick={() => toggleExtra(tt)}
                  aria-pressed={active}
                  className={cn(
                    "h-6 rounded-md text-[11px] font-semibold tracking-wide border uppercase px-2 transition-colors",
                    active ? cn(chip.solid, "ring-2 ring-offset-1 ring-offset-[var(--ds-background-200)] ring-[var(--ds-gray-1000)]") : cn(chip.soft),
                  )}
                >
                  {typeName(tt)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
