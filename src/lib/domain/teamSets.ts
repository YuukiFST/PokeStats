/**
 * Per-slot Set resolution and team composition validation.
 * Slots reference a dataset Set via setKey; when the reference is missing
 * (older saves) or stale (dataset changed), resolution falls back to the
 * best-ranked Set so saved Teams keep working.
 */
import type { Form, Set, TeamSlot } from "./types"

export const GEN_RANK: Record<string, number> = { rb: 1, gs: 2, rs: 3, dp: 4, bw: 5, xy: 6, sm: 7, ss: 8, sv: 9 }

/** Latest Dex Gen first, OU-family formats before the rest, then name. */
export function rankFormSets(sets: Set[]): Set[] {
  return [...sets].sort((a, b) => {
    const gen = (GEN_RANK[b.dexGen] ?? 0) - (GEN_RANK[a.dexGen] ?? 0)
    if (gen !== 0) return gen
    const ou = (a.formatId.includes("ou") ? -1 : 0) - (b.formatId.includes("ou") ? -1 : 0)
    if (ou !== 0) return ou
    return a.name.localeCompare(b.name)
  })
}

/** The Set a slot plays: referenced setKey when it still exists, else the best-ranked Set. */
export function resolveSlotSet(slot: TeamSlot, setsForForm: Set[]): Set | null {
  if (setsForForm.length === 0) return null
  const key = slot.setKey
  if (key) {
    const hit = setsForForm.find((s) => s.dexGen === key.dexGen && s.formatId === key.formatId && s.name === key.name)
    if (hit) return hit
  }
  return rankFormSets(setsForForm)[0] ?? null
}

/** Short label for slot pickers: name plus where the Set comes from. */
export function setLabel(set: Set): string {
  return `${set.name} · ${set.dexGen}/${set.formatId}`
}

/** Hazard-removal options by Showdown move name. */
const HAZARD_REMOVAL = new Set(["Rapid Spin", "Defog", "Mortal Spin", "Tidy Up", "Court Change"])
/** Speed-order options by Showdown move name. */
const SPEED_CONTROL = new Set([
  "Tailwind",
  "Trick Room",
  "Thunder Wave",
  "Glare",
  "Nuzzle",
  "Sticky Web",
  "Icy Wind",
  "Electroweb",
])

export interface ResolvedMember {
  form: Form
  set: Set | null
}

export interface TeamValidation {
  /** Item names (as written) held by more than one member. */
  duplicateItems: string[]
  /** More than one Mega/Primal member; only one can mega-evolve per battle. */
  multiMega: boolean
  /** No resolved Set clicks a hazard-removal move. */
  missingHazardRemoval: boolean
  /** No resolved Set clicks a speed-control move. */
  missingSpeedControl: boolean
}

function slotMoves(member: ResolvedMember): string[] {
  if (!member.set) return []
  return member.set.moves.flatMap((options) => options)
}

/** Flags composition problems over resolved members; empty teams validate clean. */
export function validateTeam(members: ResolvedMember[]): TeamValidation {
  const seen = new Map<string, { count: number; label: string }>()
  for (const m of members) {
    const item = m.set?.item?.trim()
    if (!item) continue
    const k = item.toLowerCase()
    const cur = seen.get(k) ?? { count: 0, label: item }
    cur.count++
    seen.set(k, cur)
  }
  const megaCount = members.filter((m) => m.form.traits.includes("mega") || m.form.traits.includes("primal")).length
  const allMoves = new Set(members.flatMap(slotMoves).map((mv) => mv.trim().toLowerCase()))
  const hasAny = (pool: Set<string>) => {
    for (const mv of pool) if (allMoves.has(mv.toLowerCase())) return true
    return false
  }
  return {
    duplicateItems: [...seen.values()].filter((v) => v.count > 1).map((v) => v.label),
    multiMega: megaCount > 1,
    missingHazardRemoval: members.length > 0 && !hasAny(HAZARD_REMOVAL),
    missingSpeedControl: members.length > 0 && !hasAny(SPEED_CONTROL),
  }
}
