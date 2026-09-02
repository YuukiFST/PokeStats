import type {
  AbilityInfo,
  DatasetCatalog,
  DatasetCore,
  DatasetDex,
  DatasetSets,
  Form,
  ItemInfo,
  LearnsetsArtifact,
  MoveInfo,
  NatureInfo,
  Species,
  TypeName,
} from "@/lib/domain/types"
import { defensiveProfile, TYPE_NAMES } from "@/lib/domain/typeChart"
import { toSlug } from "@/lib/utils"

export interface LoadedDataset {
  core: DatasetCore
  sets: DatasetSets
  /** Inverted index moveId (slug) -> FormIds that learn it. Lazy artifact, loaded with the rest. */
  learnsets: LearnsetsArtifact
  /** False until sets.json + learnsets.json have settled (success or warned-empty). */
  extrasReady: boolean
  /** False until catalog.json (moves/items/…) is merged. Dex does not wait on this. */
  catalogReady: boolean
  formsById: Map<string, Form>
  speciesById: Map<number, Species>
  enrichment: Map<string, { bst: number; defensive: Record<string, number> }>
  nameIndex: { slug: string; name: string; formId: string }[]
  movesByName: Map<string, MoveInfo>
  /** Canonical moveId (slug) -> MoveInfo, for route params like /moves/$moveId. */
  movesById: Map<string, MoveInfo>
  itemsByName: Map<string, ItemInfo>
  itemsById: Map<string, ItemInfo>
  abilitiesByName: Map<string, AbilityInfo>
  naturesByName: Map<string, NatureInfo>
}

type EarlyWindow = Window & {
  __POKESTATS_DEX__?: Promise<DatasetDex>
  __POKESTATS_CATALOG__?: Promise<DatasetCatalog>
}

function emptyCore(dex: DatasetDex): DatasetCore {
  return {
    ...dex,
    tierOverrides: [],
    baseStatOverrides: [],
    typeOverrides: [],
    formats: [],
    moves: [],
    items: [],
    abilities: [],
    natures: [],
  }
}

function emptyMaps(): Pick<
  LoadedDataset,
  "movesByName" | "movesById" | "itemsByName" | "itemsById" | "abilitiesByName" | "naturesByName"
> {
  return {
    movesByName: new Map(),
    movesById: new Map(),
    itemsByName: new Map(),
    itemsById: new Map(),
    abilitiesByName: new Map(),
    naturesByName: new Map(),
  }
}

/** Forms + species maps only — Dex first paint. Catalog maps stay empty. */
export function indexDex(dex: DatasetDex): Omit<LoadedDataset, "sets" | "learnsets" | "extrasReady"> {
  const formsById = new Map(dex.forms.map((f) => [f.id, f] as const))
  const speciesById = new Map(dex.species.map((s) => [s.id, s] as const))
  return {
    core: emptyCore(dex),
    formsById,
    speciesById,
    enrichment: new Map(),
    nameIndex: [],
    catalogReady: false,
    ...emptyMaps(),
  }
}

function fillEnrichment(forms: Form[]): {
  enrichment: LoadedDataset["enrichment"]
  nameIndex: LoadedDataset["nameIndex"]
} {
  const enrichment = new Map<string, { bst: number; defensive: Record<string, number> }>()
  const nameIndex: LoadedDataset["nameIndex"] = []
  for (const f of forms) {
    const bst = f.baseStats.hp + f.baseStats.atk + f.baseStats.def + f.baseStats.spa + f.baseStats.spd + f.baseStats.spe
    const defensive = defensiveProfile(f.types as unknown as string[] as never) as Record<string, number>
    enrichment.set(f.id, { bst, defensive })
    nameIndex.push({ slug: f.id, name: f.name, formId: f.id })
  }
  nameIndex.sort((a, b) => a.name.localeCompare(b.name))
  return { enrichment, nameIndex }
}

/** Merge moves/items/… into a dex-indexed dataset. Reuses formsById / speciesById. */
export function applyCatalog(
  indexed: Omit<LoadedDataset, "sets" | "learnsets" | "extrasReady">,
  catalog: DatasetCatalog,
): Omit<LoadedDataset, "sets" | "learnsets" | "extrasReady"> {
  const { enrichment, nameIndex } = fillEnrichment(indexed.core.forms)
  return {
    ...indexed,
    core: { ...indexed.core, ...catalog },
    catalogReady: true,
    enrichment,
    nameIndex,
    movesByName: new Map(catalog.moves.map((m) => [m.name, m] as const)),
    movesById: new Map(catalog.moves.map((m) => [toSlug(m.name), m] as const)),
    itemsByName: new Map(catalog.items.map((i) => [i.name, i] as const)),
    itemsById: new Map(catalog.items.map((i) => [toSlug(i.name), i] as const)),
    abilitiesByName: new Map(catalog.abilities.map((a) => [a.name, a] as const)),
    naturesByName: new Map(catalog.natures.map((n) => [n.name, n] as const)),
  }
}

export function indexCore(core: DatasetCore): Omit<LoadedDataset, "sets" | "learnsets" | "extrasReady"> {
  return applyCatalog(indexDex(core), core)
}

export function withExtras(
  indexed: Omit<LoadedDataset, "sets" | "learnsets" | "extrasReady">,
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

function yieldToPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    return new Promise((resolve) => setTimeout(resolve, 0))
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
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

function takeEarly<T>(key: "__POKESTATS_DEX__" | "__POKESTATS_CATALOG__"): Promise<T> | null {
  if (typeof window === "undefined") return null
  const w = window as EarlyWindow
  const p = w[key] as Promise<T> | undefined
  if (!p) return null
  delete w[key]
  return p
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function loadDexPayload(): Promise<{ dex: DatasetDex; coreFallback: DatasetCore | null }> {
  const early = takeEarly<DatasetDex>("__POKESTATS_DEX__")
  if (early) {
    try {
      const dex = await early
      if (dex?.forms) return { dex, coreFallback: null }
    } catch {
      // fall through to fetch
    }
  }
  const dex = await fetchJson<DatasetDex>("/dataset/dex.json")
  if (dex?.forms) return { dex, coreFallback: null }
  const coreRes = await fetch("/dataset/core.json")
  if (!coreRes.ok) throw new Error(`core.json fetch failed: ${coreRes.status}`)
  const core = (await coreRes.json()) as DatasetCore
  return { dex: core, coreFallback: core }
}

async function loadCatalogPayload(coreFallback: DatasetCore | null): Promise<DatasetCatalog | null> {
  if (coreFallback) return coreFallback
  const early = takeEarly<DatasetCatalog>("__POKESTATS_CATALOG__")
  if (early) {
    try {
      const catalog = await early
      if (catalog?.moves) return catalog
    } catch {
      // fall through
    }
  }
  return fetchJson<DatasetCatalog>("/dataset/catalog.json")
}

function scheduleAfterPaint(fn: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      requestAnimationFrame(fn)
    })
  } else {
    setTimeout(fn, 0)
  }
}

export async function loadDataset(): Promise<LoadedDataset> {
  if (cache) return cache
  if (coreInflight) return coreInflight

  coreInflight = (async () => {
    const started = performance.now()
    // Kick catalog in parallel with dex (HTML may already have it in flight).
    const catalogP = loadCatalogPayload(null)

    const { dex, coreFallback } = await loadDexPayload()
    cache = withExtras(indexDex(dex), { sets: [] }, {}, false)
    console.log(`[dataset] dex ${dex.forms.length} forms in ${(performance.now() - started).toFixed(1)}ms`)
    notifyDataset()

    const mergeCatalog = (catalog: DatasetCatalog | null) => {
      if (!cache || !catalog || cache.catalogReady) return
      cache = withExtras(applyCatalog(cache, catalog), cache.sets, cache.learnsets, cache.extrasReady)
      console.log(`[dataset] catalog ${(performance.now() - started).toFixed(1)}ms`)
      notifyDataset()
    }

    if (coreFallback) mergeCatalog(coreFallback)
    else void catalogP.then(mergeCatalog).catch((e) => console.warn("[dataset] catalog", e))

    await yieldToPaint()
    scheduleAfterPaint(() => {
      void ensureExtras()
    })
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
  void loadDataset().catch(() => {})
}
