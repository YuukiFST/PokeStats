/**
 * Matchup math for the Threat Matchup simulator (Teams tab).
 * Type-level only: verdicts ignore Abilities, Items and Movepools — Set-aware
 * scoring lives in smartCounters.ts (CONTEXT.md Smart Counters (beta)).
 * Verdicts use a member's own Types as STAB proxy — see CONTEXT.md Offensive Coverage.
 */
import { TYPE_NAMES, defensiveProfile, getMultiplier as chartMultiplier } from "./typeChart"
import type { TypeName } from "./types"

export type VerdictKey = "excellent" | "good" | "neutral" | "bad" | "none"

/** Damage an attacking Type deals to a defender Form's Type combination. */
export function attackMultiplier(atk: TypeName, defTypes: TypeName[]): number {
  let mult = 1
  for (const d of defTypes) mult *= chartMultiplier(atk, d)
  return mult
}

export interface AttackRecommendation {
  type: TypeName
  mult: number
}

/** All attacking Types sorted by damage dealt to the defender: strong first, wasted last. */
export function recommendAttackTypes(defTypes: TypeName[]): {
  recommended: AttackRecommendation[]
  avoid: AttackRecommendation[]
} {
  const all = TYPE_NAMES.map((atk) => ({ type: atk, mult: attackMultiplier(atk, defTypes) }))
  return {
    recommended: all.filter((r) => r.mult > 1).sort((a, b) => b.mult - a.mult),
    avoid: all.filter((r) => r.mult <= 1).sort((a, b) => a.mult - b.mult),
  }
}

export function verdictFor(bestMult: number): VerdictKey {
  if (bestMult >= 4) return "excellent"
  if (bestMult >= 2) return "good"
  if (bestMult === 1) return "neutral"
  if (bestMult === 0) return "none"
  return "bad"
}

export interface MemberMatchup {
  formId: string
  /** Best multiplier any of the member's own Types deals to the opponent. */
  bestStabMult: number
  verdict: VerdictKey
  /** Opponent Types that hit this member for 2×+ (defensive warning). */
  threats: { mult: number; types: TypeName[] }[]
}

export function memberMatchup(memberTypes: TypeName[], oppTypes: TypeName[], formId: string): MemberMatchup {
  const oppDef = defensiveProfile(oppTypes)
  let bestStabMult = 0
  for (const atk of memberTypes) bestStabMult = Math.max(bestStabMult, oppDef[atk]!)

  const memberDef = defensiveProfile(memberTypes)
  const threats: MemberMatchup["threats"] = []
  for (const atk of oppTypes) {
    const m = memberDef[atk]!
    if (m >= 2) threats.push({ mult: m, types: [atk] })
  }
  // merge same-multiplier entries for compact display
  const merged: MemberMatchup["threats"] = []
  for (const t of threats.sort((a, b) => b.mult - a.mult)) {
    const last = merged[merged.length - 1]
    if (last && last.mult === t.mult) last.types.push(t.types[0]!)
    else merged.push({ mult: t.mult, types: [...t.types] })
  }

  return { formId, bestStabMult, verdict: verdictFor(bestStabMult), threats: merged }
}
