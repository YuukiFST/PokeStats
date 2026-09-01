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
