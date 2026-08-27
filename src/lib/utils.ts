export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

/**
 * Canonical slug: lowercase, unaccented, alphanumeric only.
 * Matches Showdown pokedex key in 1517/1517 entries (ticket 08 A1).
 * Used as FormId — never display name.
 */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

/**
 * BST is sum, not average. Display sum per V1 convention (CONTEXT.md:38).
 */
export function calcBST(s: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }): number {
  return s.hp + s.atk + s.def + s.spa + s.spd + s.spe
}

/** Canonical stat order and competitive abbreviations (HP/Atk/Def/SpA/SpD/Spe). */
export const STAT_LABEL: Record<string, string> = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" }

/** "252 HP / 4 Def / 252 SpD" in canonical stat order; null when absent/empty. */
export function formatSpread(spread?: Partial<Record<string, number>>): string | null {
  if (!spread) return null
  const parts = Object.keys(STAT_LABEL)
    .filter((k) => typeof spread[k] === "number")
    .map((k) => `${spread[k]} ${STAT_LABEL[k]}`)
  return parts.length > 0 ? parts.join(" / ") : null
}
