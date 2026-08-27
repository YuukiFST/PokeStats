import type { TypeName } from "./types"

/**
 * Type Chart Gen 6+ (Fairy present). Constant, not in Dataset (ticket 08).
 * Values are damage multipliers for attacker -> defender.
 * Derived from research and verified against Showdown typechart.ts.
 * Keep as source of truth for Defensive Profile and Offensive Coverage.
 */
export const TYPE_NAMES: TypeName[] = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
]

export type TypeIndex = number // 0..17

export const typeToIndex: Record<TypeName, TypeIndex> = Object.fromEntries(
  TYPE_NAMES.map((n, i) => [n, i]),
) as Record<TypeName, TypeIndex>

// Matrix attacker row vs defender col: multiplier. 0, 0.5, 1, 2.
const CHART: number[][] = (() => {
  const m = Array.from({ length: 18 }, () => Array(18).fill(1) as number[])
  const set = (atk: TypeName, def: TypeName, v: number) => {
    m[typeToIndex[atk]]![typeToIndex[def]] = v
  }

  // Normal
  set("Normal", "Rock", 0.5)
  set("Normal", "Ghost", 0)
  set("Normal", "Steel", 0.5)
  // Fire
  set("Fire", "Fire", 0.5)
  set("Fire", "Water", 0.5)
  set("Fire", "Grass", 2)
  set("Fire", "Ice", 2)
  set("Fire", "Bug", 2)
  set("Fire", "Rock", 0.5)
  set("Fire", "Dragon", 0.5)
  set("Fire", "Steel", 2)
  // Water
  set("Water", "Fire", 2)
  set("Water", "Water", 0.5)
  set("Water", "Grass", 0.5)
  set("Water", "Ground", 2)
  set("Water", "Rock", 2)
  set("Water", "Dragon", 0.5)
  // Electric
  set("Electric", "Water", 2)
  set("Electric", "Electric", 0.5)
  set("Electric", "Grass", 0.5)
  set("Electric", "Ground", 0)
  set("Electric", "Flying", 2)
  set("Electric", "Dragon", 0.5)
  // Grass
  set("Grass", "Fire", 0.5)
  set("Grass", "Water", 2)
  set("Grass", "Grass", 0.5)
  set("Grass", "Poison", 0.5)
  set("Grass", "Ground", 2)
  set("Grass", "Flying", 0.5)
  set("Grass", "Bug", 0.5)
  set("Grass", "Rock", 2)
  set("Grass", "Dragon", 0.5)
  set("Grass", "Steel", 0.5)
  // Ice
  set("Ice", "Fire", 0.5)
  set("Ice", "Water", 0.5)
  set("Ice", "Grass", 2)
  set("Ice", "Ice", 0.5)
  set("Ice", "Ground", 2)
  set("Ice", "Flying", 2)
  set("Ice", "Dragon", 2)
  set("Ice", "Steel", 0.5)
  // Fighting
  set("Fighting", "Normal", 2)
  set("Fighting", "Ice", 2)
  set("Fighting", "Poison", 0.5)
  set("Fighting", "Flying", 0.5)
  set("Fighting", "Psychic", 0.5)
  set("Fighting", "Bug", 0.5)
  set("Fighting", "Rock", 2)
  set("Fighting", "Ghost", 0)
  set("Fighting", "Dark", 2)
  set("Fighting", "Steel", 2)
  set("Fighting", "Fairy", 0.5)
  // Poison
  set("Poison", "Grass", 2)
  set("Poison", "Poison", 0.5)
  set("Poison", "Ground", 0.5)
  set("Poison", "Rock", 0.5)
  set("Poison", "Ghost", 0.5)
  set("Poison", "Steel", 0)
  set("Poison", "Fairy", 2)
  // Ground
  set("Ground", "Fire", 2)
  set("Ground", "Electric", 2)
  set("Ground", "Grass", 0.5)
  set("Ground", "Poison", 2)
  set("Ground", "Flying", 0)
  set("Ground", "Bug", 0.5)
  set("Ground", "Rock", 2)
  set("Ground", "Steel", 2)
  // Flying
  set("Flying", "Electric", 0.5)
  set("Flying", "Grass", 2)
  set("Flying", "Fighting", 2)
  set("Flying", "Bug", 2)
  set("Flying", "Rock", 0.5)
  set("Flying", "Steel", 0.5)
  // Psychic
  set("Psychic", "Fighting", 2)
  set("Psychic", "Poison", 2)
  set("Psychic", "Psychic", 0.5)
  set("Psychic", "Dark", 0)
  set("Psychic", "Steel", 0.5)
  // Bug
  set("Bug", "Fire", 0.5)
  set("Bug", "Grass", 2)
  set("Bug", "Fighting", 0.5)
  set("Bug", "Poison", 0.5)
  set("Bug", "Flying", 0.5)
  set("Bug", "Psychic", 2)
  set("Bug", "Ghost", 0.5)
  set("Bug", "Dark", 2)
  set("Bug", "Steel", 0.5)
  set("Bug", "Fairy", 0.5)
  // Rock
  set("Rock", "Fire", 2)
  set("Rock", "Ice", 2)
  set("Rock", "Fighting", 0.5)
  set("Rock", "Ground", 0.5)
  set("Rock", "Flying", 2)
  set("Rock", "Bug", 2)
  set("Rock", "Steel", 0.5)
  // Ghost
  set("Ghost", "Normal", 0)
  set("Ghost", "Psychic", 2)
  set("Ghost", "Ghost", 2)
  set("Ghost", "Dark", 0.5)
  // Dragon
  set("Dragon", "Dragon", 2)
  set("Dragon", "Steel", 0.5)
  set("Dragon", "Fairy", 0)
  // Dark
  set("Dark", "Fighting", 0.5)
  set("Dark", "Psychic", 2)
  set("Dark", "Ghost", 2)
  set("Dark", "Dark", 0.5)
  set("Dark", "Fairy", 0.5)
  // Steel
  set("Steel", "Fire", 0.5)
  set("Steel", "Water", 0.5)
  set("Steel", "Electric", 0.5)
  set("Steel", "Ice", 2)
  set("Steel", "Rock", 2)
  set("Steel", "Fairy", 2)
  set("Steel", "Steel", 0.5)
  // Fairy
  set("Fairy", "Fire", 0.5)
  set("Fairy", "Fighting", 2)
  set("Fairy", "Dragon", 2)
  set("Fairy", "Dark", 2)
  set("Fairy", "Poison", 0.5)
  set("Fairy", "Steel", 0.5)

  return m
})()

export function getMultiplier(atk: TypeName, def: TypeName): number {
  return CHART[typeToIndex[atk]]![typeToIndex[def]]!
}

/**
 * Defensive Profile: for a Form with 1-2 types, damage each attacking Type deals.
 * Multiplicative: dual type = product of two.
 * Ticket 08: not stored, derived on load. Property: product invariant.
 */
export function defensiveProfile(defTypes: TypeName[]): Record<TypeName, number> {
  const out = {} as Record<TypeName, number>
  for (const atk of TYPE_NAMES) {
    let mult = 1
    for (const def of defTypes) mult *= getMultiplier(atk, def)
    out[atk] = mult
  }
  return out
}

export function weaknesses(profile: Record<TypeName, number>): TypeName[] {
  return TYPE_NAMES.filter((t) => profile[t]! > 1)
}
export function resistances(profile: Record<TypeName, number>): TypeName[] {
  return TYPE_NAMES.filter((t) => profile[t]! > 0 && profile[t]! < 1)
}
export function immunities(profile: Record<TypeName, number>): TypeName[] {
  return TYPE_NAMES.filter((t) => profile[t]! === 0)
}

/**
 * Offensive Coverage: given attacker types, which defender types are hit super-effectively.
 * Used by Team Builder (ticket 13).
 */
export function offensiveCoverage(attackerTypes: TypeName[]): {
  superEffective: TypeName[]
  noEffect: TypeName[]
} {
  const superEffective = TYPE_NAMES.filter((def) =>
    attackerTypes.some((atk) => getMultiplier(atk, def) > 1),
  )
  const noEffect = TYPE_NAMES.filter((def) =>
    attackerTypes.every((atk) => getMultiplier(atk, def) === 0),
  )
  return { superEffective, noEffect }
}
