import type { ItemKind, Set } from "./types.js"

export const ITEM_KINDS: ItemKind[] = [
  "choice",
  "berry",
  "mega",
  "zcrystal",
  "plate",
  "memory",
  "drive",
  "utility",
]

/** Showdown item row (subset used for classification). */
export type ShowdownItemSrc = {
  name?: string
  megaStone?: unknown
  zMove?: unknown
  zMoveType?: unknown
  zMoveFrom?: unknown
  isBerry?: unknown
  onPlate?: unknown
  onMemory?: unknown
  onDrive?: unknown
}

export function itemKindFromShowdown(src: ShowdownItemSrc): ItemKind {
  const name = typeof src.name === "string" ? src.name : ""
  if (src.zMove || src.zMoveType || src.zMoveFrom || / Z$/.test(name)) return "zcrystal"
  if (src.megaStone) return "mega"
  if (src.isBerry) return "berry"
  if (src.onPlate) return "plate"
  if (src.onMemory) return "memory"
  if (src.onDrive) return "drive"
  if (name.startsWith("Choice ")) return "choice"
  return "utility"
}

export function itemIdForName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

export function setsUsingItem(sets: Set[], name: string): Set[] {
  return sets.filter((s) => s.item === name || s.itemOptions?.includes(name))
}

/** One increment per Set that holds the item in any slot. Primary is often duplicated in `itemOptions`. */
export function countSetsByHeldItem(sets: Set[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of sets) {
    const names = new Set<string>()
    if (s.item) names.add(s.item)
    if (s.itemOptions) for (const n of s.itemOptions) names.add(n)
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  return counts
}
