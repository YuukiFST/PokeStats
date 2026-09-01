import type { Form, Set, Species, StatKey } from "@/lib/domain/types"
import { toSlug } from "@/lib/utils"

export const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"]

const STAT_FLAG: Record<StatKey, string> = {
  hp: "hp",
  atk: "attack",
  def: "defence",
  spa: "special_attack",
  spd: "special_defence",
  spe: "speed",
}

const ASPECT_BY_SUFFIX: Record<string, string> = {
  megax: "mega-x",
  megay: "mega-y",
  mega: "mega",
  alola: "alola",
  galar: "galar",
  hisui: "hisui",
  paldea: "paldea",
  paldeacombat: "combat",
  paldeablaze: "blaze",
  paldeaaqua: "aqua",
  primal: "primal",
  origin: "origin",
  therian: "therian",
  incarnate: "incarnate",
  wash: "wash",
  heat: "heat",
  frost: "frost",
  fan: "fan",
  mow: "mow",
}

/** Species / item ids: snake_case, Cobblemon registry style (mr_mime, choice_specs). */
export function cobblemonSnake(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/** Ability and move ids: Showdown-style alphanumeric slug (roughskin, uturn). */
export function cobblemonSlug(name: string): string {
  return toSlug(name)
}

export function formSuffix(form: Form, species: Species): string | null {
  if (form.isBaseForm) return null
  const base = species.formIds[0]
  if (base && form.id.startsWith(base) && form.id.length > base.length) return form.id.slice(base.length)
  return null
}

export function cobblemonFormFlags(form: Form, species: Species): string[] {
  const suffix = formSuffix(form, species)
  if (!suffix) return []
  if (suffix === "gmax") return ["gmax_factor=true"]
  const aspect = ASPECT_BY_SUFFIX[suffix] ?? suffix
  return [`aspect=${aspect}`]
}

function spreadFlags(spread: Partial<Record<string, number>> | undefined, kind: "ev" | "iv"): string[] {
  if (!spread) return []
  const out: string[] = []
  for (const short of STAT_KEYS) {
    const n = spread[short]
    if (typeof n === "number") out.push(`${STAT_FLAG[short]}_${kind}=${n}`)
  }
  return out
}

/**
 * IVs for /pokemonedit: 31 on any stat invested at 252 EVs; otherwise keep the
 * Set's listed IVs (e.g. 0 Atk) and omit the rest so Cobblemon keeps its default.
 */
export function defaultCommandIvs(set: Set): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {}
  for (const key of STAT_KEYS) {
    if (set.evs?.[key] === 252) out[key] = 31
    else if (typeof set.ivs?.[key] === "number") out[key] = set.ivs[key]
  }
  return out
}

export function buildPokemonEditCommand(input: {
  slot: number
  species: Species
  form: Form
  set: Set
  item?: string
  moves?: string[]
  ivs?: Partial<Record<StatKey, number>>
}): string {
  const slot = Math.min(6, Math.max(1, Math.floor(input.slot)))
  const parts = [`/pokemonedit`, String(slot), cobblemonSnake(input.species.name)]
  parts.push(...cobblemonFormFlags(input.form, input.species))
  if (input.set.level) parts.push(`level=${input.set.level}`)
  if (input.set.ability) parts.push(`ability=${cobblemonSlug(input.set.ability)}`)
  if (input.set.nature) parts.push(`nature=${cobblemonSlug(input.set.nature)}`)
  const item = input.item ?? input.set.item
  if (item) parts.push(`helditem=cobblemon:${cobblemonSnake(item)}`)
  const moves = (input.moves ?? input.set.moves.map((slotMoves) => slotMoves[0]!))
    .map((name) => cobblemonSlug(name))
    .filter(Boolean)
  if (moves.length) parts.push(`moves=${moves.join(",")}`)
  parts.push(...spreadFlags(input.set.evs, "ev"))
  parts.push(...spreadFlags(input.ivs ?? defaultCommandIvs(input.set), "iv"))
  if (input.set.teraType) parts.push(`tera_type=${cobblemonSlug(input.set.teraType)}`)
  return parts.join(" ")
}
