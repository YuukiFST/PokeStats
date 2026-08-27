import type { AbilityInfo, DatasetCore, DatasetSets, Form, ItemInfo, LearnsetsArtifact, MoveInfo, NatureInfo, Species, TypeName } from "@/lib/domain/types"
import { defensiveProfile, TYPE_NAMES } from "@/lib/domain/typeChart"
import { toSlug } from "@/lib/utils"

export interface LoadedDataset {
  core: DatasetCore
  sets: DatasetSets
  /** Inverted index moveId (slug) -> FormIds that learn it. Lazy artifact, loaded with the rest. */
  learnsets: LearnsetsArtifact
  formsById: Map<string, Form>
  speciesById: Map<number, Species>
  enrichment: Map<string, { bst: number; defensive: Record<string, number> }>
  nameIndex: { slug: string; name: string; formId: string }[]
  movesByName: Map<string, MoveInfo>
  /** Canonical moveId (slug) -> MoveInfo, for route params like /moves/$moveId. */
  movesById: Map<string, MoveInfo>
  itemsByName: Map<string, ItemInfo>
  abilitiesByName: Map<string, AbilityInfo>
  naturesByName: Map<string, NatureInfo>
}

let cache: LoadedDataset | null = null
let inflight: Promise<LoadedDataset> | null = null

export async function loadDataset(): Promise<LoadedDataset> {
  if (cache) return cache
  if (inflight) return inflight

  inflight = (async () => {
    const started = performance.now()
    const coreRes = await fetch("/dataset/core.json")
    if (!coreRes.ok) throw new Error(`core.json fetch failed: ${coreRes.status}`)
    const core: DatasetCore = await coreRes.json()

    const setsRes = await fetch("/dataset/sets.json")
    if (!setsRes.ok) throw new Error(`sets.json fetch failed: ${setsRes.status}`)
    const sets: DatasetSets = await setsRes.json()

    // learnsets.json is optional (build emits {} when the fixture is missing)
    let learnsets: LearnsetsArtifact = {}
    try {
      const learnRes = await fetch("/dataset/learnsets.json")
      if (learnRes.ok) learnsets = (await learnRes.json()) as LearnsetsArtifact
    } catch {
      // offline-tolerant: move->learners features degrade to empty
    }

    const formsById = new Map(core.forms.map((f) => [f.id, f] as const))
    const speciesById = new Map(core.species.map((s) => [s.id, s] as const))

    const enrichment = new Map<string, { bst: number; defensive: Record<string, number> }>()
    const nameIndex: LoadedDataset["nameIndex"] = []

    for (const f of core.forms) {
      const bst = f.baseStats.hp + f.baseStats.atk + f.baseStats.def + f.baseStats.spa + f.baseStats.spd + f.baseStats.spe
      const defensive = defensiveProfile(f.types as unknown as string[] as never) as Record<string, number>
      enrichment.set(f.id, { bst, defensive })
      nameIndex.push({ slug: f.id, name: f.name, formId: f.id })
    }
    nameIndex.sort((a, b) => a.name.localeCompare(b.name))

    const movesByName = new Map(core.moves.map((m) => [m.name, m] as const))
    const movesById = new Map(core.moves.map((m) => [toSlug(m.name), m] as const))
    const itemsByName = new Map(core.items.map((i) => [i.name, i] as const))
    const abilitiesByName = new Map(core.abilities.map((a) => [a.name, a] as const))
    const naturesByName = new Map(core.natures.map((n) => [n.name, n] as const))

    const elapsed = performance.now() - started
    if (elapsed > 500) console.warn(`[dataset] slow load: ${elapsed.toFixed(1)}ms`)
    else console.log(`[dataset] loaded ${core.forms.length} forms in ${elapsed.toFixed(1)}ms`)

    cache = { core, sets, learnsets, formsById, speciesById, enrichment, nameIndex, movesByName, movesById, itemsByName, abilitiesByName, naturesByName }
    return cache
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

export function getDatasetSync(): LoadedDataset | null {
  return cache
}

/**
 * Resolves a Set move name to its MoveInfo. "Hidden Power <Type>" variants
 * have no row of their own — they resolve to the base Hidden Power with the
 * suffix as type (same scheme the build uses).
 */
export function resolveMoveInfo(movesByName: Map<string, MoveInfo>, name: string): MoveInfo | null {
  const direct = movesByName.get(name)
  if (direct) return direct
  if (name.startsWith("Hidden Power ")) {
    const suffix = name.slice("Hidden Power ".length)
    const base = movesByName.get("Hidden Power")
    if (base && TYPE_NAMES.includes(suffix as TypeName)) return { ...base, name, type: suffix as TypeName }
  }
  return null
}

/**
 * Canonical learnsets key for a Set move name. "Hidden Power <Type>" variants
 * share the Base Form pool under `hiddenpower` (same scheme the build uses).
 */
export function moveIdForName(name: string): string {
  const id = toSlug(name)
  if (id.startsWith("hiddenpower")) return "hiddenpower"
  return id
}

/** FormIds that can learn a Set move name, or [] when the artifact lacks it. */
export function learnersForMove(learnsets: LearnsetsArtifact, moveName: string): string[] {
  return learnsets[moveIdForName(moveName)] ?? []
}

// Preload on module init to warm cache ASAP (ticket 11: parse once, keep in mem)
if (typeof window !== "undefined") {
  // fire and forget, but shared via inflight so concurrent callers reuse
  void loadDataset().catch(() => {})
}
