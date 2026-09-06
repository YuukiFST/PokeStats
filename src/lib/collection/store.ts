/**
 * Cobblemon collection tracker: what the player owns in game.
 * Pure storage helpers (tested) plus a React provider below in collection/.
 */
import type { FormId } from "@/lib/domain/types"

export type CollectionFlag = "owned" | "shiny" | "wanted"

export interface CollectionEntry {
  formId: FormId
  owned: boolean
  shiny: boolean
  wanted: boolean
}

export const COLLECTION_KEY = "pokestats:collection:v1"
const COLLECTION_VERSION = 1

export function emptyEntry(formId: FormId): CollectionEntry {
  return { formId, owned: false, shiny: false, wanted: false }
}

export function toggleFlag(entries: CollectionEntry[], formId: FormId, flag: CollectionFlag): CollectionEntry[] {
  const idx = entries.findIndex((e) => e.formId === formId)
  if (idx === -1) return [...entries, { ...emptyEntry(formId), [flag]: true }]
  const next = entries.slice()
  const cur = next[idx]!
  const updated = { ...cur, [flag]: !cur[flag] }
  // Drop fully-empty rows so the store only holds real marks.
  if (!updated.owned && !updated.shiny && !updated.wanted) next.splice(idx, 1)
  else next[idx] = updated
  return next
}

export function entryFor(entries: CollectionEntry[], formId: FormId): CollectionEntry {
  return entries.find((e) => e.formId === formId) ?? emptyEntry(formId)
}

export function serializeCollection(entries: CollectionEntry[]): string {
  return JSON.stringify({ v: COLLECTION_VERSION, entries })
}

/** Never throws; corrupt or foreign payloads fall back to empty. */
export function parseCollection(raw: string | null): CollectionEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return []
    const o = parsed as Record<string, unknown>
    if (o.v !== COLLECTION_VERSION || !Array.isArray(o.entries)) return []
    const out: CollectionEntry[] = []
    const seen = new Set<string>()
    for (const row of o.entries) {
      if (!row || typeof row !== "object") continue
      const r = row as Record<string, unknown>
      if (typeof r.formId !== "string" || r.formId.length === 0 || seen.has(r.formId)) continue
      const owned = r.owned === true
      const shiny = r.shiny === true
      const wanted = r.wanted === true
      if (!owned && !shiny && !wanted) continue
      seen.add(r.formId)
      out.push({ formId: r.formId, owned, shiny, wanted })
    }
    return out
  } catch {
    return []
  }
}
