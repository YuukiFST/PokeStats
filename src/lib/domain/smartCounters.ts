/**
 * Smart Counters (beta, CONTEXT.md Application): score candidate Forms against an
 * opponent's actual Sets — the opponent's real movepool (defensive side), the
 * candidate's own movepool with level-100 survival estimates (offensive side),
 * outspeed checks and a Set-count meta signal. Complements, never replaces, the
 * type-math suggestCounters: Forms without Sets fall back to a capped baseline.
 */
import { resolveMoveInfo } from "@/lib/dataset/load"
import { GEN_RANK } from "@/lib/showdown"
import { estimateBattleState, survivalCheck, type BattleState, type KoClass } from "./damage"
import { emptyMovesetProfile, movesetProfile, type MovesetProfile } from "./moveset"
import { typeMathCounterScore, windowByBst, type CounterWindowOptions } from "./recommend"
import type { Form, FormId, MoveInfo, NatureInfo, Set, TypeName } from "./types"

/** Representative Set per Form: latest Dex Gen, OU-family Formats first, then name (same order as the Showdown Export builder). */
export function representativeSet(sets: Set[]): Set | undefined {
  if (sets.length === 0) return undefined
  return [...sets].sort((a, b) => {
    const gen = (GEN_RANK[b.dexGen] ?? 0) - (GEN_RANK[a.dexGen] ?? 0)
    if (gen !== 0) return gen
    const ou = (a.formatId.includes("ou") ? -1 : 0) - (b.formatId.includes("ou") ? -1 : 0)
    if (ou !== 0) return ou
    return a.name.localeCompare(b.name)
  })[0]
}

export interface SmartCounterIndex {
  profiles: Map<FormId, MovesetProfile>
  battle: Map<FormId, BattleState>
  setCount: Map<FormId, number>
}

/** Precompute per-Form moveset profiles and battle states once per Dataset load. */
export function buildSmartCounterIndex(
  forms: Form[],
  sets: Set[],
  movesByName: Map<string, MoveInfo>,
  naturesByName: Map<string, NatureInfo>,
): SmartCounterIndex {
  const resolveMove = (name: string) => resolveMoveInfo(movesByName, name)
  const resolveNature = (name: string | undefined) => (name ? (naturesByName.get(name) ?? null) : null)
  const byForm = new Map<FormId, Set[]>()
  for (const s of sets) {
    const list = byForm.get(s.formId)
    if (list) list.push(s)
    else byForm.set(s.formId, [s])
  }
  const profiles = new Map<FormId, MovesetProfile>()
  const battle = new Map<FormId, BattleState>()
  const setCount = new Map<FormId, number>()
  for (const form of forms) {
    const formSets = byForm.get(form.id) ?? []
    profiles.set(form.id, formSets.length > 0 ? movesetProfile(formSets, resolveMove) : emptyMovesetProfile())
    battle.set(form.id, estimateBattleState(form, representativeSet(formSets), resolveNature))
    setCount.set(form.id, formSets.length)
  }
  return { profiles, battle, setCount }
}

const indexCache = new WeakMap<Set[], SmartCounterIndex>()

/** One SmartCounterIndex per Sets array identity — the dataset loads Sets once, so this is once per app run. */
export function getSmartCounterIndex(
  forms: Form[],
  sets: Set[],
  movesByName: Map<string, MoveInfo>,
  naturesByName: Map<string, NatureInfo>,
): SmartCounterIndex {
  const hit = indexCache.get(sets)
  if (hit) return hit
  const built = buildSmartCounterIndex(forms, sets, movesByName, naturesByName)
  indexCache.set(sets, built)
  return built
}

export type SmartReasonKind = "walls" | "carries" | "outspeed" | "frail"

export type SmartSuggestionReason =
  | { kind: "walls"; type: TypeName }
  | { kind: "carries"; type: TypeName }
  | { kind: "frail"; type: TypeName }
  | { kind: "outspeed" }

export interface SmartFormSuggestion {
  form: Form
  score: number
  reasons: SmartSuggestionReason[]
  /** True when the Form has no Sets: score is the capped type-math baseline. */
  noSets: boolean
}

// Score weights (beta: hand-tuned, adjust with playtesting feedback).
const BASELINE_WEIGHT = 0.5
/** Forms without Sets: final score multiplier so they never outrank a Set-bearing Form of comparable profile. */
const NO_SETS_CAP = 0.6
const OUTSPEED_BONUS = 0.4
/** Meta signal saturates: 5+ Sets give the full bonus (niche utility mons with 20 Sets gain nothing more). */
const META_WEIGHT = 0.6
const META_SATURATION = 5
/** Canonical sv Tier as a usage-quality signal (OU staples > PU filler). */
const TIER_WEIGHT = 0.4
/** Absolute stat quality from Base Stats: bulk measured on the side the opponent attacks. */
const STAT_BULK_WEIGHT = 0.7
const STAT_BULK_BENCHMARK = 350
const STAT_OFFENSE_WEIGHT = 0.5
const STAT_OFFENSE_BENCHMARK = 130
/** OHKOed by a move the opponent clicks at least this much -> halved score (an immune glass cannon is not a counter). */
const FRAILTY_GATE_WEIGHT = 0.25
const FRAILTY_GATE_MULTIPLIER = 0.5

/** Defensive: opponent Move KO class -> delta multiplier on the Move-Type weight. */
const DEFENSIVE_KO_DELTA: Record<KoClass, number> = { none: 2.5, chip: 2, "3hko": 0.5, "2hko": -1.5, ohko: -3 }
/** Offensive: candidate Move KO class -> delta multiplier on the Move-Type weight. */
const OFFENSIVE_KO_DELTA: Record<KoClass, number> = { ohko: 3, "2hko": 2, "3hko": 1, chip: 0.25, none: 0 }
/** Higher = worse for the defender (used to keep the best threat per Type). */
const KO_RANK: Record<KoClass, number> = { ohko: 4, "2hko": 3, "3hko": 2, chip: 1, none: 0 }
const REASON_ORDER: Record<SmartReasonKind, number> = { walls: 0, carries: 1, outspeed: 2, frail: 3 }

/** Canonical sv Tier (dataset spellings, incl. `Uber` and `(OU)`) -> usage quality 0..1. */
const TIER_QUALITY: Record<string, number> = {
  OU: 1,
  AG: 1,
  UUBL: 0.9,
  Uber: 0.9,
  UU: 0.75,
  RUBL: 0.65,
  RU: 0.55,
  NUBL: 0.45,
  NU: 0.4,
  PUBL: 0.3,
  PU: 0.25,
  ZUBL: 0.15,
  ZU: 0.1,
  LC: 0.1,
  NFE: 0.05,
}

function tierQuality(tier: string | null): number {
  if (!tier) return 0
  return TIER_QUALITY[tier.replaceAll("(", "").replaceAll(")", "")] ?? 0
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** Best KO class per attacking Type across a movepool (worst threat on defense, best threat on offense). */
function bestKoByType(
  moves: MoveInfo[],
  attacker: BattleState,
  defender: BattleState,
): Map<TypeName, KoClass> {
  const best = new Map<TypeName, KoClass>()
  for (const move of moves) {
    const ko = survivalCheck(move, attacker, defender)
    const prev = best.get(move.type)
    if (prev === undefined || KO_RANK[ko] > KO_RANK[prev]) best.set(move.type, ko)
  }
  return best
}

function reasonId(r: SmartSuggestionReason): string {
  return "type" in r ? `${r.kind}:${r.type}` : r.kind
}

function pushUnique(reasons: SmartSuggestionReason[], reason: SmartSuggestionReason): void {
  if (!reasons.some((r) => reasonId(r) === reasonId(reason))) reasons.push(reason)
}

/**
 * Smart counter suggestions vs one opponent Form. Deterministic; candidates are
 * every Form except `excludeIds`. The Smart score picks the relevance pool; the
 * window displays highest-BST first (see windowByBst). Requires
 * buildSmartCounterIndex (memoize per Dataset, not per opponent).
 */
export function scoreSmartCounters(
  opp: Form,
  index: SmartCounterIndex,
  allForms: Form[],
  excludeIds: ReadonlySet<string>,
): SmartFormSuggestion[] {
  const oppProfile = index.profiles.get(opp.id) ?? emptyMovesetProfile()
  const oppBattle = index.battle.get(opp.id)!
  const oppTypes = opp.types as unknown as TypeName[]
  return allForms
    .filter((f) => !excludeIds.has(f.id))
    .map((form) => {
      const profile = index.profiles.get(form.id) ?? emptyMovesetProfile()
      const battle = index.battle.get(form.id)!
      const setCount = index.setCount.get(form.id) ?? 0
      const noSets = setCount === 0
      const reasons: SmartSuggestionReason[] = []
      // baseline: reduced type math keeps no-Set Forms rankable among themselves
      let score = typeMathCounterScore(form, oppTypes).score * BASELINE_WEIGHT
      // defensive: how the candidate handles what the opponent actually clicks
      let frailType: TypeName | null = null
      let frailDelta = 0
      let gatedByOhko = false
      for (const [type, ko] of bestKoByType(oppProfile.attackMoves, oppBattle, battle)) {
        const w = oppProfile.typeWeights.get(type) ?? 0
        if (w <= 0) continue
        const delta = DEFENSIVE_KO_DELTA[ko] * w
        score += delta
        if (ko === "none" || ko === "chip") pushUnique(reasons, { kind: "walls", type })
        if (ko === "ohko" && w >= FRAILTY_GATE_WEIGHT) gatedByOhko = true
        if (delta < frailDelta) {
          frailDelta = delta
          frailType = type
        }
      }
      if (frailType) pushUnique(reasons, { kind: "frail", type: frailType })
      // offensive: what the candidate actually threatens back
      let carryType: TypeName | null = null
      let carryDelta = 0
      for (const [type, ko] of bestKoByType(profile.attackMoves, battle, oppBattle)) {
        const w = profile.typeWeights.get(type) ?? 0
        if (w <= 0) continue
        const delta = OFFENSIVE_KO_DELTA[ko] * w
        if (delta > carryDelta) {
          carryDelta = delta
          carryType = type
        }
        score += delta
      }
      if (carryType && carryDelta >= 1) pushUnique(reasons, { kind: "carries", type: carryType })
      // tempo + quality signals
      if (!noSets && battle.stats.spe > oppBattle.stats.spe) {
        score += OUTSPEED_BONUS
        pushUnique(reasons, { kind: "outspeed" })
      }
      if (!noSets) score += META_WEIGHT * Math.min(1, setCount / META_SATURATION)
      score += TIER_WEIGHT * tierQuality(form.tier)
      // absolute stat quality: bulk on the side the opponent attacks + best offensive stat
      const p = oppProfile.physicalShare
      const s = form.baseStats
      const bulk = s.hp + 2 * (p * s.def + (1 - p) * s.spd)
      score += STAT_BULK_WEIGHT * clamp01(bulk / STAT_BULK_BENCHMARK)
      score += STAT_OFFENSE_WEIGHT * clamp01(Math.max(s.atk, s.spa) / STAT_OFFENSE_BENCHMARK)
      if (gatedByOhko) score *= FRAILTY_GATE_MULTIPLIER
      if (noSets) score *= NO_SETS_CAP
      reasons.sort(
        (a, b) =>
          REASON_ORDER[a.kind] - REASON_ORDER[b.kind] ||
          ("type" in a ? a.type : "").localeCompare("type" in b ? b.type : ""),
      )
      return { form, score, reasons, noSets }
    })
}

export function suggestSmartCounters(
  opp: Form,
  index: SmartCounterIndex,
  allForms: Form[],
  excludeIds: ReadonlySet<string>,
  opts: CounterWindowOptions = {},
): SmartFormSuggestion[] {
  return windowByBst(scoreSmartCounters(opp, index, allForms, excludeIds), opts)
}
