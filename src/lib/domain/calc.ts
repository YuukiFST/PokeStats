/**
 * Real-stat calculator and damage estimator. Pure functions over Base Stats,
 * Set spreads and the type chart — the only place in the app that computes
 * level-scaled stats, and only from explicit user inputs.
 */
import { defensiveProfile } from "./typeChart"
import { natureFactor } from "./natures"
import type { BaseStatSpread, Form, MoveInfo, NatureInfo, StatKey } from "./types"

export const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"]

export interface CalcInputs {
  level: number
  nature: NatureInfo
  evs: Partial<BaseStatSpread>
  ivs: Partial<BaseStatSpread>
}

export const MAX_EV_STAT = 252
export const MAX_EV_TOTAL = 510

export function clampInt(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, Math.floor(v)))
}

export function evTotal(evs: Partial<BaseStatSpread>): number {
  return STAT_KEYS.reduce((sum, k) => sum + (evs[k] ?? 0), 0)
}

/** Standard stat formula. HP has no nature modifier. */
export function calcStat(base: number, iv: number, ev: number, level: number, natureMult: number): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5
  return Math.floor(core * natureMult)
}

export function calcHPStat(base: number, iv: number, ev: number, level: number): number {
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10
}

/** Full level-scaled spread for a Form under the given inputs. */
export function finalStats(base: BaseStatSpread, inputs: CalcInputs): BaseStatSpread {
  const level = clampInt(inputs.level, 1, 100)
  const out = {} as BaseStatSpread
  for (const k of STAT_KEYS) {
    const iv = clampInt(inputs.ivs[k] ?? 31, 0, 31)
    const ev = clampInt(inputs.evs[k] ?? 0, 0, MAX_EV_STAT)
    out[k] = k === "hp" ? calcHPStat(base[k], iv, ev, level) : calcStat(base[k], iv, ev, level, natureFactor(inputs.nature, k))
  }
  return out
}

// ---------- damage ----------

export interface DamageEstimate {
  /** Null for Status moves (no damage). */
  min: number | null
  max: number | null
  defenderHP: number
  /** Share of the 16 damage rolls that KO, 0..1. Null for Status moves. */
  koChance: number | null
  stab: boolean
  effectiveness: number
}

function effectivenessOf(moveType: string, defenderTypes: string[]): number {
  const profile = defensiveProfile(defenderTypes as never)
  return (profile as Record<string, number>)[moveType] ?? 1
}

/**
 * Gen 5+ damage formula without crit, burn, weather, screens or Tera.
 * Random spread is the exact 16-roll table (85..100), so koChance is exact.
 */
export function damageRange(
  move: MoveInfo,
  attacker: { form: Form; stats: BaseStatSpread; level: number },
  defender: { form: Form; stats: BaseStatSpread },
): DamageEstimate {
  const defenderHP = defender.stats.hp
  const stab =
    move.type !== undefined &&
    (attacker.form.types as string[]).includes(move.type as string)
  const effectiveness = effectivenessOf(move.type as string, defender.form.types as string[])
  if (move.category === "Status" || move.power == null) {
    return { min: null, max: null, defenderHP, koChance: null, stab, effectiveness }
  }
  const atkStat = move.category === "Physical" ? attacker.stats.atk : attacker.stats.spa
  const defStat = move.category === "Physical" ? defender.stats.def : defender.stats.spd
  const safeDef = Math.max(1, defStat)
  const level = clampInt(attacker.level, 1, 100)
  const levelTerm = Math.floor((2 * level) / 5) + 2
  const base = Math.floor(Math.floor((levelTerm * move.power * atkStat) / safeDef) / 50) + 2
  const mod = (stab ? 1.5 : 1) * effectiveness
  if (mod === 0) return { min: 0, max: 0, defenderHP, koChance: 0, stab, effectiveness }
  let kos = 0
  let min = Number.POSITIVE_INFINITY
  let max = 0
  for (let roll = 85; roll <= 100; roll++) {
    const dmg = Math.floor((base * mod * roll) / 100)
    if (dmg < min) min = dmg
    if (dmg > max) max = dmg
    if (dmg >= defenderHP) kos++
  }
  return { min, max, defenderHP, koChance: kos / 16, stab, effectiveness }
}
