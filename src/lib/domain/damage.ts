/**
 * Internal simplified battle model for Smart Counters scoring (CONTEXT.md
 * Application: Smart Counters (beta)). Level-scaled stats and damage estimates
 * are computed FOR SCORING ONLY — PokeStats ships no stat calculator and never
 * displays a computed stat. Formulas: Gen 5+ stat/damage math, max roll (1.0),
 * no crits/burns/items/field effects. Nature and move resolution are injected
 * so this module stays free of dataset-loading concerns.
 */
import { getMultiplier } from "./typeChart"
import type { BaseStatSpread, Form, MoveCategory, MoveInfo, Set, StatKey, TypeName } from "./types"

export interface BattleState {
  stats: BaseStatSpread
  types: [TypeName] | [TypeName, TypeName]
  /** Ability the representative Set runs; falls back to slot0. */
  ability: string
  level: number
}

export type NatureShape = { plus: StatKey | null; minus: StatKey | null }

const DEFAULT_IV = 31
/** Stand-in base power for variable-power attacking Moves (Gyro Ball, Low Kick…). */
const VARIABLE_POWER = 70

function natureMod(nature: NatureShape | null, stat: StatKey): number {
  if (!nature) return 1
  if (nature.plus === stat) return 1.1
  if (nature.minus === stat) return 0.9
  return 1
}

/** Level-100-style stat from Base Stats + Set spread. Shedinja-style HP 1 is preserved. */
export function estimateBattleState(
  form: Form,
  set: Set | undefined,
  resolveNature: (name: string | undefined) => NatureShape | null,
): BattleState {
  const level = set?.level ?? 100
  const evs = set?.evs
  const ivs = set?.ivs
  const nature = resolveNature(set?.nature)
  const stat = (key: StatKey, base: number): number => {
    const iv = ivs?.[key] ?? DEFAULT_IV
    const ev = evs?.[key] ?? 0
    const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
    return Math.floor(raw * natureMod(nature, key))
  }
  const hpBase = form.baseStats.hp
  const hp =
    hpBase === 1
      ? 1
      : Math.floor(((2 * hpBase + (ivs?.hp ?? DEFAULT_IV) + Math.floor((evs?.hp ?? 0) / 4)) * level) / 100) + level + 10
  return {
    stats: {
      hp,
      atk: stat("atk", form.baseStats.atk),
      def: stat("def", form.baseStats.def),
      spa: stat("spa", form.baseStats.spa),
      spd: stat("spd", form.baseStats.spd),
      spe: stat("spe", form.baseStats.spe),
    },
    types: form.types,
    ability: set?.ability ?? form.abilities.slot0,
    level,
  }
}

/**
 * Defensive Ability overrides: Ability -> attacking Type -> damage multiplier.
 * Heuristic subset covering the common switch-in walls; everything else falls
 * through to the type chart. Names match Dataset Ability spellings.
 */
const DEFENDER_TYPE_MULT: Record<string, Partial<Record<TypeName, number>>> = {
  Levitate: { Ground: 0 },
  "Flash Fire": { Fire: 0 },
  "Water Absorb": { Water: 0 },
  "Volt Absorb": { Electric: 0 },
  "Motor Drive": { Electric: 0 },
  "Lightning Rod": { Electric: 0 },
  "Storm Drain": { Water: 0 },
  "Sap Sipper": { Grass: 0 },
  "Earth Eater": { Ground: 0 },
  "Dry Skin": { Water: 0, Fire: 1.25 },
  "Thick Fat": { Fire: 0.5, Ice: 0.5 },
  Heatproof: { Fire: 0.5 },
  "Water Bubble": { Fire: 0.5 },
  "Purifying Salt": { Ghost: 0.5, Poison: 0.5 },
  Multiscale: { Normal: 0.5, Fire: 0.5, Water: 0.5, Electric: 0.5, Grass: 0.5, Ice: 0.5, Fighting: 0.5, Poison: 0.5, Ground: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 0.5, Ghost: 0.5, Dragon: 0.5, Dark: 0.5, Steel: 0.5, Fairy: 0.5 },
}

/** Category-based defensive Abilities (Ice Scales, Fur Coat). */
const DEFENDER_CATEGORY_MULT: Record<string, Partial<Record<MoveCategory, number>>> = {
  "Ice Scales": { Special: 0.5 },
  "Fur Coat": { Physical: 0.5 },
}

/** Offensive Ability boosts: attack multiplier by Move category, STAB bonus. */
const ATTACKER_CATEGORY_MULT: Record<string, Partial<Record<MoveCategory, number>>> = {
  "Huge Power": { Physical: 2 },
  "Pure Power": { Physical: 2 },
}

/** STAB multiplier for these Abilities instead of the default 1.5. */
const ADAPTABILITY_STAB: Record<string, number> = { Adaptability: 2 }

/** Type-chart multiplier after the defender's Ability overrides. */
export function effectiveTypeMultiplier(
  moveType: TypeName,
  category: MoveCategory,
  defender: BattleState,
): number {
  let mult = 1
  for (const def of defender.types) mult *= getMultiplier(moveType, def)
  const byType = DEFENDER_TYPE_MULT[defender.ability]?.[moveType]
  if (byType !== undefined) return mult === 0 ? 0 : byType
  const byCategory = DEFENDER_CATEGORY_MULT[defender.ability]?.[category]
  if (byCategory !== undefined) return mult * byCategory
  return mult
}

export type KoClass = "ohko" | "2hko" | "3hko" | "chip" | "none"

export interface DamageEstimate {
  typeMult: number
  /** Max-roll damage per hit; 0 for Status/variable-power Moves. */
  damage: number
  ko: KoClass
}

/** Max-roll damage per hit for one Move, or damage 0 when not estimable (Status, power null). */
export function estimateDamage(move: MoveInfo, attacker: BattleState, defender: BattleState): DamageEstimate {
  if (move.category === "Status") return { typeMult: 0, damage: 0, ko: "none" }
  const typeMult = effectiveTypeMultiplier(move.type, move.category, defender)
  const power = move.power ?? VARIABLE_POWER
  if (power <= 0 || typeMult === 0) return { typeMult, damage: 0, ko: "none" }
  const physical = move.category === "Physical"
  const a = physical ? attacker.stats.atk : attacker.stats.spa
  const d = physical ? defender.stats.def : defender.stats.spd
  const levelTerm = Math.floor((2 * attacker.level) / 5) + 2
  let damage = Math.floor(Math.floor((levelTerm * power * a) / d) / 50) + 2
  // Modifiers floor after each step, matching the games' sequential application.
  damage = Math.floor(damage * (ATTACKER_CATEGORY_MULT[attacker.ability]?.[move.category] ?? 1))
  if (attacker.types.includes(move.type)) damage = Math.floor(damage * (ADAPTABILITY_STAB[attacker.ability] ?? 1.5))
  damage = Math.floor(damage * typeMult)
  const hp = defender.stats.hp
  const ko: KoClass =
    hp > 0 && damage >= hp ? "ohko"
    : hp > 0 && damage >= hp / 2 ? "2hko"
    : hp > 0 && damage >= hp / 3 ? "3hko"
    : damage > 0 ? "chip"
    : "none"
  return { typeMult, damage, ko }
}

/** survivalCheck: can the defender take repeated hits of this Move? */
export function survivalCheck(move: MoveInfo, attacker: BattleState, defender: BattleState): KoClass {
  return estimateDamage(move, attacker, defender).ko
}
