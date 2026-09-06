import * as React from "react"
import { useI18n } from "@/lib/i18n"
import type { LoadedDataset } from "@/lib/dataset/load"
import { NATURES } from "@/lib/domain/natures"
import {
  MAX_EV_STAT,
  MAX_EV_TOTAL,
  STAT_KEYS,
  clampInt,
  damageRange,
  evTotal,
  finalStats,
  type CalcInputs,
} from "@/lib/domain/calc"
import type { BaseStatSpread, Form, Set, StatKey } from "@/lib/domain/types"
import { STAT_LABEL } from "@/lib/utils"
import { moveIdForName } from "@/lib/dataset/load"
import { SpriteThumb } from "@/components/ui/sprite"

interface SideState {
  level: number
  nature: string
  evs: Partial<BaseStatSpread>
  ivs: Partial<BaseStatSpread>
}

const DEFAULT_SIDE: SideState = { level: 100, nature: "Serious", evs: {}, ivs: {} }

function toInputs(s: SideState): CalcInputs {
  return {
    level: s.level,
    nature: NATURES.find((n) => n.name === s.nature) ?? NATURES[0]!,
    evs: s.evs,
    ivs: s.ivs,
  }
}

function prefillFromSet(set: Set | undefined): Partial<SideState> {
  if (!set) return {}
  return {
    nature: set.nature ?? "Serious",
    evs: { ...(set.evs ?? {}) },
    ivs: { ...(set.ivs ?? {}) },
  }
}

function NumberBox({
  value,
  min,
  max,
  onChange,
  aria,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  aria: string
}) {
  return (
    <input
      type="number"
      aria-label={aria}
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(clampInt(Number(e.target.value), min, max))}
      className="h-7 w-16 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-1 text-right text-xs tnum"
    />
  )
}

function SideEditor({
  title,
  form,
  forms,
  onPickForm,
  state,
  onChange,
  sets,
  prefillLabel,
}: {
  title: string
  form: Form
  forms?: Form[]
  onPickForm?: (form: Form) => void
  state: SideState
  onChange: (next: SideState) => void
  sets: Set[]
  prefillLabel: string
}) {
  const { t } = useI18n()
  const [query, setQuery] = React.useState("")
  const matches = React.useMemo(() => {
    if (!onPickForm || !forms) return []
    const q = query.trim().toLowerCase()
    if (!q) return []
    return forms.filter((f) => f.name.toLowerCase().includes(q) || f.id.includes(q)).slice(0, 8)
  }, [query, forms, onPickForm])
  const total = evTotal(state.evs)

  return (
    <div className="flex-1 min-w-[260px] rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <SpriteThumb form={form} expandable={false} />
        <div className="min-w-0">
          <div className="text-[11px] uppercase text-[var(--ds-gray-700)]">{title}</div>
          <div className="truncate text-sm font-semibold">{form.name}</div>
        </div>
      </div>
      {onPickForm && forms && (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("calc.searchDefender")}
            className="h-7 w-full rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] px-2 text-xs"
          />
          {query && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] p-1">
              {matches.map((f) => (
                <button
                  key={f.id}
                  className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-[var(--ds-gray-100)]"
                  onClick={() => {
                    onPickForm(f)
                    setQuery("")
                  }}
                >
                  {f.name}
                </button>
              ))}
              {matches.length === 0 && <div className="p-2 text-xs text-[var(--ds-gray-700)]">{t("teams.noResults")}</div>}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          {t("calc.level")}
          <NumberBox value={state.level} min={1} max={100} aria={t("calc.level")} onChange={(v) => onChange({ ...state, level: v })} />
        </label>
        <label className="flex items-center gap-1">
          {t("calc.nature")}
          <select
            value={state.nature}
            onChange={(e) => onChange({ ...state, nature: e.target.value })}
            className="h-7 rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-1 text-xs"
          >
            {NATURES.map((n) => (
              <option key={n.name} value={n.name}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        {sets.length > 0 && (
          <label className="flex items-center gap-1">
            {prefillLabel}
            <select
              value=""
              onChange={(e) => {
                const hit = sets.find((_, i) => `${i}` === e.target.value)
                if (hit) onChange({ ...state, ...prefillFromSet(hit) })
              }}
              className="h-7 max-w-[160px] rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-1 text-xs"
            >
              <option value="">—</option>
              {sets.map((s, i) => (
                <option key={`${s.dexGen}|${s.formatId}|${s.name}`} value={`${i}`}>
                  {s.name} · {s.dexGen}/{s.formatId}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="grid grid-cols-[36px_64px_64px] items-center gap-x-2 gap-y-1 text-xs">
        <span />
        <span className="text-[var(--ds-gray-700)]">EV</span>
        <span className="text-[var(--ds-gray-700)]">IV</span>
        {STAT_KEYS.map((k: StatKey) => (
          <React.Fragment key={k}>
            <span className="uppercase text-[var(--ds-gray-700)]">{STAT_LABEL[k]}</span>
            <NumberBox
              value={state.evs[k] ?? 0}
              min={0}
              max={MAX_EV_STAT}
              aria={`EV ${k}`}
              onChange={(v) => onChange({ ...state, evs: { ...state.evs, [k]: v } })}
            />
            <NumberBox
              value={state.ivs[k] ?? 31}
              min={0}
              max={31}
              aria={`IV ${k}`}
              onChange={(v) => onChange({ ...state, ivs: { ...state.ivs, [k]: v } })}
            />
          </React.Fragment>
        ))}
      </div>
      <div className={`text-xs tnum ${total > MAX_EV_TOTAL ? "text-amber-500 font-semibold" : "text-[var(--ds-gray-700)]"}`}>
        EV {total}/{MAX_EV_TOTAL}
        {total > MAX_EV_TOTAL ? ` · ${t("calc.evOver")}` : ""}
      </div>
    </div>
  )
}

/**
 * Stat calculator with Set prefill and a damage estimate against a defender.
 * Mounted on the Form detail stats tab; the Form itself is the attacker.
 */
export function StatCalculator({ form, sets, data }: { form: Form; sets: Set[]; data: LoadedDataset }) {
  const { t } = useI18n()
  const [atk, setAtk] = React.useState<SideState>(DEFAULT_SIDE)
  const [defForm, setDefForm] = React.useState<Form>(form)
  const [def, setDef] = React.useState<SideState>(DEFAULT_SIDE)
  const [moveName, setMoveName] = React.useState<string | null>(null)

  const atkSets = React.useMemo(() => sets, [sets])
  const movePool = React.useMemo(() => {
    const names = new Set<string>()
    for (const s of atkSets) for (const options of s.moves) for (const m of options) names.add(m)
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [atkSets])
  const pickedMove = moveName ?? movePool[0] ?? null
  const moveInfo = pickedMove ? (data.movesById.get(moveIdForName(pickedMove)) ?? null) : null

  const atkStats = React.useMemo(() => finalStats(form.baseStats, toInputs(atk)), [form, atk])
  const defSets = React.useMemo(() => data.setsByFormId.get(defForm.id) ?? [], [data, defForm.id])
  const defStats = React.useMemo(() => finalStats(defForm.baseStats, toInputs(def)), [defForm, def])

  const est = React.useMemo(() => {
    if (!moveInfo) return null
    return damageRange(moveInfo, { form, stats: atkStats, level: clampInt(atk.level, 1, 100) }, { form: defForm, stats: defStats })
  }, [moveInfo, form, atkStats, atk.level, defForm, defStats])

  const koPct = est && est.koChance !== null ? Math.round(est.koChance * 100) : null
  const maxPct = est && est.max !== null ? Math.round((est.max / est.defenderHP) * 100) : null
  const verdict = est
    ? est.min === null || est.max === null
      ? t("calc.statusMove")
      : est.koChance === 1
        ? t("calc.guaranteedKo")
        : (est.koChance ?? 0) > 0
          ? `${t("calc.possibleKo")} ${koPct}%`
          : `${t("calc.noKo")} ${maxPct}%)`
    : null

  return (
    <section className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-200)] p-4">
      <h2 className="text-sm font-semibold mb-1">{t("calc.title")}</h2>
      <p className="mb-3 text-xs text-[var(--ds-gray-700)]">{t("calc.assumptions")}</p>
      <div className="flex flex-wrap gap-3">
        <SideEditor title={t("calc.attacker")} form={form} state={atk} onChange={setAtk} sets={atkSets} prefillLabel={t("calc.prefill")} />
        <SideEditor
          title={t("calc.defender")}
          form={defForm}
          forms={data.core.forms as Form[]}
          onPickForm={(f) => {
            setDefForm(f)
            setDef(DEFAULT_SIDE)
          }}
          state={def}
          onChange={setDef}
          sets={defSets}
          prefillLabel={t("calc.prefill")}
        />
      </div>

      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(64px,72px))] gap-2 text-center">
        {STAT_KEYS.map((k: StatKey) => (
          <div key={k} className="rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-1 py-1.5">
            <div className="text-[10px] uppercase text-[var(--ds-gray-700)]">{STAT_LABEL[k]}</div>
            <div className="tnum text-sm font-semibold">{atkStats[k]}</div>
            <div className="tnum text-[10px] text-[var(--ds-gray-700)]">{t("calc.vs")} {defStats[k]}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1 text-xs">
          {t("calc.move")}
          <select
            value={pickedMove ?? ""}
            onChange={(e) => setMoveName(e.target.value || null)}
            className="h-7 max-w-[220px] rounded-md border border-[var(--ds-gray-400)] bg-[var(--ds-background-100)] px-1 text-xs"
          >
            {movePool.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {moveInfo ? (
          <span className="text-xs text-[var(--ds-gray-700)]">
            {moveInfo.type} · {moveInfo.category} · {t("calc.power")} {moveInfo.power ?? "—"}
            {est && ` · STAB ${est.stab ? "✓" : "—"} · ×${est.effectiveness}`}
          </span>
        ) : (
          <span className="text-xs text-[var(--ds-gray-700)]">{t("calc.noMoveData")}</span>
        )}
      </div>
      {est && est.min !== null && est.max !== null && (
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="tnum text-lg font-semibold">
            {est.min}–{est.max}
          </span>
          <span className="tnum text-xs text-[var(--ds-gray-700)]">
            ({Math.round((est.min / est.defenderHP) * 100)}–{Math.round((est.max / est.defenderHP) * 100)}%)
          </span>
          {verdict && (
            <span className="rounded-full border border-[var(--ds-gray-400)] px-2 py-0.5 text-[11px] font-medium">{verdict}</span>
          )}
        </div>
      )}
      {verdict && (est?.min === null || moveInfo?.category === "Status") && (
        <div className="mt-2 text-xs text-[var(--ds-gray-700)]">{verdict}</div>
      )}
    </section>
  )
}
