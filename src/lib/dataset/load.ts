import type { AbilityInfo, DatasetCore, DatasetSets, Form, ItemInfo, LearnsetsArtifact, MoveInfo, NatureInfo, Species, TypeName } from "@/lib/domain/types"
import { defensiveProfile, TYPE_NAMES } from "@/lib/domain/typeChart"
import { toSlug } from "@/lib/utils"

export interface LoadedDataset {
  core: DatasetCore
  sets: DatasetSets
  /** Inverted index moveId (slug) -> FormIds that learn it. Lazy artifact, loaded with the rest. */
  learnsets: LearnsetsArtifact
  /** False until sets.json + learnsets.json have settled (success or warned-empty). */
  extrasReady: boolean
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

export function indexCore(core: DatasetCore): Omit<LoadedDataset, "sets" | "learnsets" | "extrasReady"> {
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

  return { core, formsById, speciesById, enrichment, nameIndex, movesByName, movesById, itemsByName, abilitiesByName, naturesByName }
}

export function withExtras(
  indexed: ReturnType<typeof indexCore> & { core: DatasetCore },
  sets: DatasetSets,
  learnsets: LearnsetsArtifact,
  extrasReady: boolean,
): LoadedDataset {
  return { ...indexed, sets, learnsets, extrasReady }
}

let cache: LoadedDataset | null = null
let coreInflight: Promise<LoadedDataset> | null = null
let extrasInflight: Promise<void> | null = null
const listeners = new Set<() => void>()

export function subscribeDataset(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function notifyDataset(): void {
  for (const fn of listeners) fn()
}

async function loadSets(): Promise<DatasetSets> {
  try {
    const setsRes = await fetch("/dataset/sets.json")
    if (!setsRes.ok) {
      console.warn(`[dataset] sets.json fetch failed: ${setsRes.status}`)
      return { sets: [] }
    }
    return (await setsRes.json()) as DatasetSets
  } catch (e) {
    console.warn("[dataset] sets.json failed", e)
    return { sets: [] }
  }
}

async function loadLearnsets(): Promise<LearnsetsArtifact> {
  try {
    const learnRes = await fetch("/dataset/learnsets.json")
    if (learnRes.ok) return (await learnRes.json()) as LearnsetsArtifact
  } catch {
    // offline-tolerant: move->learners features degrade to empty
  }
  return {}
}

export async function ensureExtras(): Promise<void> {
  if (cache?.extrasReady) return
  if (extrasInflight) return extrasInflight

  extrasInflight = (async () => {
    const started = performance.now()
    const [sets, learnsets] = await Promise.all([loadSets(), loadLearnsets()])
    if (!cache) return
    cache = withExtras(cache, sets, learnsets, true)
    const elapsed = performance.now() - started
    if (elapsed > 500) console.warn(`[dataset] extras ${elapsed.toFixed(1)}ms`)
    else console.log(`[dataset] extras ${elapsed.toFixed(1)}ms`)
    notifyDataset()
  })()

  try {
    await extrasInflight
  } finally {
    extrasInflight = null
  }
}

export async function loadDataset(): Promise<LoadedDataset> {
  if (cache) return cache
  if (coreInflight) return coreInflight

  coreInflight = (async () => {
    const started = performance.now()
    const coreRes = await fetch("/dataset/core.json")
    if (!coreRes.ok) throw new Error(`core.json fetch failed: ${coreRes.status}`)
    const core: DatasetCore = await coreRes.json()

    cache = withExtras(indexCore(core), { sets: [] }, {}, false)
    const elapsed = performance.now() - started
    if (elapsed > 500) console.warn(`[dataset] core ${elapsed.toFixed(1)}ms`)
    else console.log(`[dataset] core ${core.forms.length} forms in ${elapsed.toFixed(1)}ms`)
    notifyDataset()
    // Let the Dex commit before parsing sets.json + learnsets.json on the main thread.
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void ensureExtras()
        })
      })
    } else {
      setTimeout(() => {
        void ensureExtras()
      }, 0)
    }
    return cache
  })()

  try {
    return await coreInflight
  } finally {
    coreInflight = null
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
