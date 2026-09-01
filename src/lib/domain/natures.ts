import type { NatureInfo, Set, StatKey } from "./types.js"

/** Stats natures can raise or lower. HP is never modified. */
export const NATURE_STAT_KEYS: StatKey[] = ["atk", "def", "spa", "spd", "spe"]

/** Diagonal of the 5×5: same plus and minus cancels to a named Neutral. */
const NEUTRAL_BY_STAT: Record<StatKey, string> = {
  hp: "Hardy",
  atk: "Hardy",
  def: "Docile",
  spa: "Bashful",
  spd: "Quirky",
  spe: "Serious",
}

export const NATURES: NatureInfo[] = [
  { name: "Adamant", plus: "atk", minus: "spa" },
  { name: "Bashful", plus: null, minus: null },
  { name: "Bold", plus: "def", minus: "atk" },
  { name: "Brave", plus: "atk", minus: "spe" },
  { name: "Calm", plus: "spd", minus: "atk" },
  { name: "Careful", plus: "spd", minus: "spa" },
  { name: "Docile", plus: null, minus: null },
  { name: "Gentle", plus: "spd", minus: "def" },
  { name: "Hardy", plus: null, minus: null },
  { name: "Hasty", plus: "spe", minus: "def" },
  { name: "Impish", plus: "def", minus: "spa" },
  { name: "Jolly", plus: "spe", minus: "spa" },
  { name: "Lax", plus: "def", minus: "spd" },
  { name: "Lonely", plus: "atk", minus: "def" },
  { name: "Mild", plus: "spa", minus: "def" },
  { name: "Modest", plus: "spa", minus: "atk" },
  { name: "Naive", plus: "spe", minus: "spd" },
  { name: "Naughty", plus: "atk", minus: "spd" },
  { name: "Quiet", plus: "spa", minus: "spe" },
  { name: "Quirky", plus: null, minus: null },
  { name: "Rash", plus: "spa", minus: "spd" },
  { name: "Relaxed", plus: "def", minus: "spe" },
  { name: "Sassy", plus: "spd", minus: "spe" },
  { name: "Serious", plus: null, minus: null },
  { name: "Timid", plus: "spe", minus: "atk" },
]

export function natureAt(plus: StatKey, minus: StatKey, table: NatureInfo[] = NATURES): NatureInfo | null {
  if (plus === minus) {
    const name = NEUTRAL_BY_STAT[plus]
    return table.find((n) => n.name === name) ?? null
  }
  return table.find((n) => n.plus === plus && n.minus === minus) ?? null
}

export function natureCellStats(n: NatureInfo): { plus: StatKey; minus: StatKey } | null {
  if (n.plus && n.minus) return { plus: n.plus, minus: n.minus }
  if (n.name === "Hardy") return { plus: "atk", minus: "atk" }
  if (n.name === "Docile") return { plus: "def", minus: "def" }
  if (n.name === "Bashful") return { plus: "spa", minus: "spa" }
  if (n.name === "Quirky") return { plus: "spd", minus: "spd" }
  if (n.name === "Serious") return { plus: "spe", minus: "spe" }
  return null
}

export function setsUsingNature(sets: Set[], name: string): Set[] {
  return sets.filter((s) => s.nature === name)
}

/** Nature modifier on a combat stat. HP is always 1. */
export function natureFactor(n: NatureInfo, stat: StatKey): 1 | 1.1 | 0.9 {
  if (stat === "hp") return 1
  if (n.plus === stat) return 1.1
  if (n.minus === stat) return 0.9
  return 1
}
