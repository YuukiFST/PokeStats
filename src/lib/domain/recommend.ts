/**
 * Recommendation engine: pure type-math over the Dataset, same STAB proxy as
 * matchup.ts (CONTEXT.md Offensive Coverage). Two consumers:
 * - suggestTeamAdditions: patches a Team's defensive holes + offensive gaps.
 * - suggestCounters: Forms that wall an opponent's Types and hit back SE.
 */
import { TYPE_NAMES, defensiveProfile } from "./typeChart"
import { attackMultiplier } from "./matchup"
import type { BaseStatSpread, Form, FormTrait, StatKey, TypeName } from "./types"

const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"]

/** `"none"` matches Forms with no Trait (ordinary/base). OR semantics across selected kinds. */
export type TraitFilterOption = FormTrait | "none"

/** Thresholds applied before ranking so the limit slice keeps only qualifying Forms. */
export interface SuggestionFilters {
  /** Minimum Base Stat Total; 0/undefined = off. */
  minBst?: number
  /** Per-stat minimums; 0/undefined = no floor for that stat. */
  minStats?: Partial<BaseStatSpread>
  /** Kinds allowed through; undefined = all. Empty set hides everything. */
  allowedTraits?: ReadonlySet<TraitFilterOption>
}

function passesFilters(form: Form, filters?: SuggestionFilters): boolean {
  if (!filters) return true
  if (filters.allowedTraits) {
    const ok =
      form.traits.some((tr) => filters.allowedTraits!.has(tr)) ||
      (form.traits.length === 0 && filters.allowedTraits.has("none"))
    if (!ok) return false
  }
  const s = form.baseStats
  const bst =
    (filters.minBst ?? 0) > 0
      ? s.hp + s.atk + s.def + s.spa + s.spd + s.spe
      : 0
  if (bst > 0 && bst < filters.minBst!) return false
  return STAT_KEYS.every((k) => {
    const min = filters.minStats?.[k]
    return !min || s[k] >= min
  })
}

export type ReasonKind = "resist" | "immune" | "cover" | "risk"

export interface SuggestionReason {
  kind: ReasonKind
  type: TypeName
}

export interface FormSuggestion {
  form: Form
  score: number
  reasons: SuggestionReason[]
}

export interface TeamContext {
  /** Attacking Types every member takes >=1x from — nobody resists these. */
  holes: TypeName[]
  /** Defender Types no member's own Types hit super-effectively. */
  offenseGaps: TypeName[]
  /** Attacking Types 3+ members are weak to — adding more of the same is a risk. */
  redundantWeak: TypeName[]
}

export function teamContext(memberTypesList: TypeName[][]): TeamContext {
  const holes = TYPE_NAMES.filter((atk) =>
    memberTypesList.length > 0 &&
    memberTypesList.every((types) => attackMultiplier(atk, types) >= 1),
  )
  const offenseGaps = TYPE_NAMES.filter((def) =>
    memberTypesList.every((types) => types.every((atk) => attackMultiplier(atk, [def]) <= 1)),
  )
  const redundantWeak = TYPE_NAMES.filter((atk) => {
    const weakCount = memberTypesList.filter((types) => attackMultiplier(atk, types) > 1).length
    return weakCount >= 3
  })
  return { holes, offenseGaps, redundantWeak }
}

interface ScoreOptions {
  holes: TypeName[]
  offenseGaps: TypeName[]
  redundantWeak: TypeName[]
  formsWithSets?: Set<string>
}

function scoreCandidate(
  form: Form,
  opts: ScoreOptions,
): { score: number; reasons: SuggestionReason[] } {
  const def = defensiveProfile(form.types as unknown as TypeName[])
  const ownTypes = form.types as unknown as TypeName[]
  const reasons: SuggestionReason[] = []
  let score =
    (form.baseStats.hp + form.baseStats.atk + form.baseStats.def + form.baseStats.spa + form.baseStats.spd + form.baseStats.spe) / 10000

  for (const hole of opts.holes) {
    const m = def[hole]!
    if (m === 0) {
      score += 3
      reasons.push({ kind: "immune", type: hole })
    } else if (m < 1) {
      score += 2
      reasons.push({ kind: "resist", type: hole })
    }
  }
  for (const gap of opts.offenseGaps) {
    const best = Math.max(...ownTypes.map((atk) => attackMultiplier(atk, [gap])))
    if (best > 1) {
      score += 1.5
      reasons.push({ kind: "cover", type: gap })
    }
  }
  for (const risky of opts.redundantWeak) {
    if (def[risky]! > 1) {
      score -= 0.75
      reasons.push({ kind: "risk", type: risky })
    }
  }
  if (opts.formsWithSets?.has(form.id)) score += 0.3
  return { score, reasons }
}

export interface SuggestAdditionsOptions {
  formsWithSets?: Set<string>
  filters?: SuggestionFilters
  /** Pinned FormIds: bypass filters, render first in pin order, never duplicated by the ranking. */
  pinnedIds?: ReadonlySet<string>
  /** Ranked-window index ("next batch" button); each step advances one full window, wrapping around. */
  offset?: number
  limit?: number
}

/** Cards per window when the caller does not cap it. */
export const SUGGESTIONS_LIMIT = 6

export interface SuggestionsResult {
  items: FormSuggestion[]
  /** Ranked candidates eligible for the window after filters — excludes pins, members and risk-only Forms. */
  rankedPoolSize: number
  /** The full filtered ranking behind `items` (pins excluded) — input for improvement plans. */
  rankedPool: FormSuggestion[]
}

/**
 * Top candidate Forms to add: patch holes first, then coverage gaps. Deterministic order.
 * `offset` rotates the ranked pool so successive calls surface every candidate exactly once per cycle.
 */
export function suggestTeamAdditions(
  members: Form[],
  allForms: Form[],
  opts: SuggestAdditionsOptions = {},
): SuggestionsResult {
  const ctx = teamContext(members.map((m) => m.types as unknown as TypeName[]))
  const memberIds = new Set(members.map((m) => m.id))
  const limit = opts.limit ?? SUGGESTIONS_LIMIT
  const candidates = allForms
    .filter((f) => !memberIds.has(f.id))
    .map((form) => {
      const { score, reasons } = scoreCandidate(form, { ...ctx, formsWithSets: opts.formsWithSets })
      return { form, score, reasons }
    })
    .filter((s) => s.reasons.some((r) => r.kind !== "risk"))
  // Pinned lookups go through a Map so stale ids (dataset bump) and duplicates are ignored.
  const byId = new Map(candidates.map((s) => [s.form.id, s] as const))
  const pinned: FormSuggestion[] = []
  for (const id of opts.pinnedIds ?? []) {
    const hit = byId.get(id)
    if (hit) pinned.push(hit)
  }
  const ranked = candidates
    .filter((s) => !opts.pinnedIds?.has(s.form.id) && passesFilters(s.form, opts.filters))
    .sort((a, b) => b.score - a.score || a.form.id.localeCompare(b.form.id))
  // Rotate instead of slicing so the "next batch" cycles back to the top after the last page.
  const fill = Math.max(0, limit - pinned.length)
  const start = ranked.length > 0 ? (((opts.offset ?? 0) * fill) % ranked.length + ranked.length) % ranked.length : 0
  const rotated = [...ranked.slice(start), ...ranked.slice(0, start)]
  return { items: [...pinned, ...rotated.slice(0, fill)], rankedPoolSize: ranked.length, rankedPool: ranked }
}

/** Options shared by swap/plan suggestion entry points. */
export interface SwapOptions {
  /** Member FormIds the user locked; those slots are never proposed as targets. */
  protectedIds?: ReadonlySet<string>
}

/**
 * Roster-quality metric: each member scored with scoreCandidate against the
 * OTHER members' context (their holes/coverage/redundancy) plus its own BST
 * term, summed over the roster — "better team" is exactly what Membros
 * Sugeridos optimizes for.
 */
function rosterQuality(roster: Form[]): number {
  return roster.reduce((acc, _form, i) => {
    const others = roster
      .filter((_f, j) => j !== i)
      .map((f) => f.types as unknown as TypeName[])
    const { score } = scoreCandidate(roster[i]!, { ...teamContext(others) })
    return acc + score
  }, 0)
}

/** Which member a candidate should replace, and what the swap gains. */
export interface SwapTarget {
  /** FormId of the current member the candidate takes the slot of. */
  memberId: string
  /** Team-quality gain vs keeping today's roster; negative = even the best swap loses coverage. */
  delta: number
}

/**
 * For each candidate Form, the member it should replace: the slot whose swap
 * yields the highest team quality (see rosterQuality). Deterministic: ties keep
 * the lowest slot index. Protected members are never proposed as targets.
 */
export function bestSwapTargets(
  members: Form[],
  candidateForms: Form[],
  opts: SwapOptions = {},
): Map<string, SwapTarget> {
  const targets = new Map<string, SwapTarget>()
  if (members.length === 0 || candidateForms.length === 0) return targets

  const baseline = rosterQuality(members)

  for (const cand of candidateForms) {
    let bestIdx = -1
    let bestDelta = -Infinity
    for (let i = 0; i < members.length; i++) {
      if (opts.protectedIds?.has(members[i]!.id)) continue
      const swapped = [...members]
      swapped[i] = cand
      const delta = rosterQuality(swapped) - baseline
      // strict > keeps the earliest slot on ties
      if (delta > bestDelta) {
        bestDelta = delta
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      targets.set(cand.id, { memberId: members[bestIdx]!.id, delta: bestDelta })
    }
  }
  return targets
}

/** A multi-slot upgrade honoring protected members. */
export interface ImprovementPlan {
  /** Member FormIds to remove, in slot order; `addIds[k]` takes the slot of `removeIds[k]`. */
  removeIds: string[]
  /** Pool FormIds moving in, aligned with `removeIds`. */
  addIds: string[]
  /** Roster-quality gain vs today's team; always > 0. */
  delta: number
}

/**
 * Best two-member upgrade around the user's locks: remove a pair of unprotected
 * members, greedily refill each freed slot with the best remaining pool candidate
 * against the partial roster's context (same metric as Membros Sugeridos), rank
 * whole plans by rosterQuality gain and return the only winner — null when no
 * two-removal plan beats today's team (single swaps are bestSwapTargets' job).
 * The greedy refill is a heuristic; it does not search joint candidate pairs.
 */
export function suggestImprovementPlan(
  members: Form[],
  pool: Form[],
  opts: SwapOptions = {},
): ImprovementPlan | null {
  const removable = members
    .map((m, i) => (opts.protectedIds?.has(m.id) ? -1 : i))
    .filter((i) => i >= 0)
  if (removable.length < 2 || pool.length === 0) return null

  const baseline = rosterQuality(members)
  let best: { removeIdx: [number, number]; adds: Form[]; delta: number } | null = null

  for (let a = 0; a < removable.length; a++) {
    for (let b = a + 1; b < removable.length; b++) {
      const removeIdx: [number, number] = [removable[a]!, removable[b]!]
      const partial = members.filter((_m, i) => i !== removeIdx[0] && i !== removeIdx[1])
      // Removed members may not come back through the pool either.
      const used = new Set([members[removeIdx[0]]!.id, members[removeIdx[1]]!.id])
      const adds: Form[] = []
      for (let step = 0; step < 2; step++) {
        const ctx = teamContext(partial.map((m) => m.types as unknown as TypeName[]))
        let pick: Form | null = null
        let pickScore = -Infinity
        for (const cand of pool) {
          if (used.has(cand.id)) continue
          const { score } = scoreCandidate(cand, { ...ctx })
          if (score > pickScore || (score === pickScore && pick && cand.id.localeCompare(pick.id) < 0)) {
            pick = cand
            pickScore = score
          }
        }
        if (!pick) break
        used.add(pick.id)
        adds.push(pick)
        partial.push(pick)
      }
      if (adds.length < 2) continue
      const delta = rosterQuality(partial) - baseline
      if (delta > 0 && (!best || delta > best.delta)) {
        best = { removeIdx, adds, delta }
      }
    }
  }
  if (!best) return null
  return {
    removeIds: [members[best.removeIdx[0]]!.id, members[best.removeIdx[1]]!.id],
    addIds: best.adds.map((f) => f.id),
    delta: best.delta,
  }
}

/**
 * v1 pure type-math score for one candidate vs one opponent's Types: resist/immune
 * the opponent's Types, hit back SE with own Types (STAB proxy), BST as tiebreaker.
 * Shared by suggestCounters (as the whole score) and Smart Counters (as baseline).
 */
export function typeMathCounterScore(
  form: Form,
  oppTypes: TypeName[],
): { score: number; reasons: SuggestionReason[] } {
  const def = defensiveProfile(form.types as unknown as TypeName[])
  const ownTypes = form.types as unknown as TypeName[]
  const reasons: SuggestionReason[] = []
  let score = 0
  // defensive: worst incoming multiplier from the opponent's Types
  let worst = 1
  for (const atk of oppTypes) {
    const m = def[atk]!
    if (m > worst) worst = m
    if (m === 0) {
      score += 2.5
      reasons.push({ kind: "immune", type: atk })
    } else if (m < 1) {
      score += 2
      reasons.push({ kind: "resist", type: atk })
    } else if (m > 1) {
      score -= 1
      reasons.push({ kind: "risk", type: atk })
    }
  }
  // offensive: best own-Type multiplier vs the opponent
  let bestHit = 0
  let bestType: TypeName | null = null
  for (const atk of ownTypes) {
    const m = attackMultiplier(atk, oppTypes)
    if (m > bestHit) {
      bestHit = m
      bestType = atk
    }
  }
  if (bestHit > 1 && bestType) {
    score += bestHit >= 4 ? 3 : 2
    reasons.push({ kind: "cover", type: bestType })
  }
  if (worst > 1) score -= worst - 1
  score +=
    (form.baseStats.hp + form.baseStats.atk + form.baseStats.def + form.baseStats.spa + form.baseStats.spd + form.baseStats.spe) /
    10000
  return { score, reasons }
}

/** Windowing options shared by both counter suggesters. */
export interface CounterWindowOptions {
  /** Ranked-window index ("rotate" button); each step advances one window, wrapping around. */
  offset?: number
  /** Pinned FormIds: bypass the pool, render first, never duplicated by the ranking. */
  pinnedIds?: ReadonlySet<string>
  /** Suggestions per window; default 4. */
  limit?: number
  /** Pool = top N candidates by score before BST display ordering. */
  poolSize?: number
}

/** Candidates kept by score before the BST-first display window. */
export const COUNTER_POOL_SIZE = 24

function bstOf(form: Form): number {
  const s = form.baseStats
  return s.hp + s.atk + s.def + s.spa + s.spd + s.spe
}

/**
 * Shared counter windowing (user directive: recommendations always display
 * strongest-BST first). The score picks the pool (top `poolSize` by score, the
 * relevance signal); BST desc orders the window so weak-stat Forms never lead.
 * Pins render first regardless of pool or score; `offset` rotates the window.
 */
export function windowByBst<T extends { form: Form; score: number }>(
  scored: T[],
  opts: CounterWindowOptions = {},
): T[] {
  const limit = opts.limit ?? 4
  const poolSize = opts.poolSize ?? COUNTER_POOL_SIZE
  const byId = new Map(scored.map((s) => [s.form.id, s] as const))
  const pinned: T[] = []
  for (const id of opts.pinnedIds ?? []) {
    const hit = byId.get(id)
    if (hit) pinned.push(hit)
  }
  const pool = scored
    .filter((s) => !opts.pinnedIds?.has(s.form.id))
    .sort((a, b) => b.score - a.score || a.form.id.localeCompare(b.form.id))
    .slice(0, poolSize)
    .sort((a, b) => bstOf(b.form) - bstOf(a.form) || b.score - a.score || a.form.id.localeCompare(b.form.id))
  const fill = Math.max(0, limit - pinned.length)
  const start = pool.length > 0 ? (((opts.offset ?? 0) * fill) % pool.length + pool.length) % pool.length : 0
  const rotated = [...pool.slice(start), ...pool.slice(0, start)]
  return [...pinned, ...rotated.slice(0, fill)]
}

/** Counter suggestions vs one opponent: resist its STABs and hit back SE. */
export function suggestCounters(
  oppTypes: TypeName[],
  allForms: Form[],
  excludeIds: Set<string>,
  opts: CounterWindowOptions = {},
): FormSuggestion[] {
  const scored = allForms
    .filter((f) => !excludeIds.has(f.id))
    .map((form) => ({ form, ...typeMathCounterScore(form, oppTypes) }))
  return windowByBst(scored, opts)
}
