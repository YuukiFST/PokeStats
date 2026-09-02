import type { Form } from "@/lib/domain/types"
import { calcBST } from "@/lib/utils"

/** True when the Form carries every selected type (AND). Empty selection matches all. */
export function formMatchesSelectedTypes(
  formTypes: readonly string[],
  selectedTypes: ReadonlySet<string>,
): boolean {
  if (selectedTypes.size === 0) return true
  for (const tt of selectedTypes) {
    if (!formTypes.includes(tt)) return false
  }
  return true
}

export type DexSortKey = "name" | "bst" | "hp" | "atk" | "def" | "spa" | "spd" | "spe" | "tier"

const collator = new Intl.Collator(undefined)

const sortCache = new WeakMap<Form[], Map<string, Form[]>>()

/** sortForms with a per-forms-array memo: a remount with the same sort key returns the same array. */
export function sortFormsCached(forms: Form[], sortBy: DexSortKey, dir: "asc" | "desc"): Form[] {
  let byKey = sortCache.get(forms)
  if (!byKey) {
    byKey = new Map()
    sortCache.set(forms, byKey)
  }
  const key = `${sortBy}:${dir}`
  const hit = byKey.get(key)
  if (hit) return hit
  const out = sortForms(forms, sortBy, dir)
  byKey.set(key, out)
  return out
}

export function sortForms(forms: Form[], sortBy: DexSortKey, dir: "asc" | "desc"): Form[] {
  const sign = dir === "asc" ? 1 : -1
  return [...forms].sort((a, b) => {
    if (sortBy === "name") return collator.compare(a.name, b.name) * sign
    if (sortBy === "tier") return collator.compare(a.tier ?? "", b.tier ?? "") * sign
    if (sortBy === "bst") return (calcBST(a.baseStats) - calcBST(b.baseStats)) * sign
    return (a.baseStats[sortBy] - b.baseStats[sortBy]) * sign
  })
}

/** Ranking collapse: one representative per Species when all its Forms share a BST; otherwise keep every Form. Preserves input order. */
export function collapseSpecies(list: Form[]): Form[] {
  const bySpecies = new Map<number, Form[]>()
  for (const f of list) {
    const arr = bySpecies.get(f.speciesId)
    if (arr) arr.push(f)
    else bySpecies.set(f.speciesId, [f])
  }
  const keep = new Set<string>()
  for (const group of bySpecies.values()) {
    if (group.length <= 1) { keep.add(group[0]!.id); continue }
    const bsts = new Set(group.map((g) => calcBST(g.baseStats)))
    if (bsts.size === 1) keep.add((group.find((g) => g.isBaseForm) ?? group[0]!).id)
    else for (const g of group) keep.add(g.id)
  }
  return list.filter((f) => keep.has(f.id))
}
