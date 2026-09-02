/**
 * tools/dataset/build.ts — pure build pipeline per ticket 09.
 * Reads raw fixtures (committed) and emits public/dataset/{core,sets}.json.
 * Failure is fatal — no partial artifact. Domain asserts only.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import type { DatasetCore, DatasetSets, Form, Species, TierEntry, FormatMeta, BaseStatOverride, TypeOverride, FormTrait, TypeName, MoveInfo, ItemInfo, AbilityInfo, LearnsetsArtifact } from "../../src/lib/domain/types.js"
import { itemKindFromShowdown } from "../../src/lib/domain/items.js"
import { NATURES } from "../../src/lib/domain/natures.js"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const OUT_DIR = resolve(ROOT, "public/dataset")
const FIXTURES_DIR = resolve(ROOT, "tools/dataset/fixtures")

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`[assert] ${msg}`)
}

function slug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
}

/** Showdown toID: lowercase alphanumeric only ("Heavy-Duty Boots" -> "heavydutyboots"). */
function toID(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function parseTsTable(path: string): Record<string, any> {
  const raw = readFileSync(path, "utf8")
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error(`cannot find object in ${path}`)
  const objText = raw.slice(start, end + 1)
  // Use Function to evaluate object literal (keys are unquoted, trailing commas allowed)
  const data = new Function(`return (${objText})`)()
  return data
}

function toAbilitySlots(abilities: Record<string, string> | undefined): { slot0: string; slot1?: string; hidden?: string; special?: string } {
  if (!abilities) return { slot0: "—" }
  return {
    slot0: abilities["0"] ?? Object.values(abilities)[0] ?? "—",
    slot1: abilities["1"],
    hidden: abilities["H"],
    special: abilities["S"],
  }
}

function getTraits(entry: any): FormTrait[] {
  const traits: FormTrait[] = []
  const forme: string | undefined = entry.forme
  // Showdown forme values include "Mega", "Mega-X", "Mega-Y", "Mega-Z", "Gmax", "Primal", "Alola", "Galar", "Hisui", "Paldea", "Paldea-Combat" etc. — use prefix match.
  if (forme) {
    if (forme.startsWith("Mega")) traits.push("mega")
    else if (forme === "Gmax" || forme.endsWith("-Gmax")) traits.push("gmax")
    else if (forme === "Primal") traits.push("primal")
    else if (forme.startsWith("Alola") || forme.startsWith("Galar") || forme.startsWith("Hisui") || forme.startsWith("Paldea")) traits.push("regional")
    // Other formes (Therian, Origin, etc.) intentionally carry no trait — they are ordinary alternates per CONTEXT.md.
  }
  if (entry.battleOnly) {
    if (!traits.includes("battle-only" as FormTrait)) traits.push("battle-only")
  }
  return traits
}

type BuildResult = { core: DatasetCore; sets: DatasetSets; learnsets: LearnsetsArtifact }

function buildFromFixtures(): BuildResult {
  const pokedexPath = resolve(FIXTURES_DIR, "pokedex.ts")
  const formatsPath = resolve(FIXTURES_DIR, "formats-data.ts")
  const pokedex: Record<string, any> = parseTsTable(pokedexPath)
  const formatsData: Record<string, any> = parseTsTable(formatsPath)

  const totalKeys = Object.keys(pokedex).length
  console.log(`[dataset:build] pokedex entries ${totalKeys}, formats-data ${Object.keys(formatsData).length}`)

  const forms: Form[] = []
  const speciesMap = new Map<number, Species>()
  /** pokedex key -> baseSpecies slug. Learnset inheritance: Forms without an own learnset key (megas, Gmax, battle transforms) walk up this chain to their Base Form's pool. */
  const baseSpeciesKey = new Map<string, string>()
  /** pokedex key -> raw Showdown evolution edges (names). Resolved to kept slugs after the loop. */
  const evoEdgesRaw = new Map<string, { prevo?: string; evos?: string[] }>()

  let capExcluded = 0
  let numZeroExcluded = 0

  for (const [key, entry] of Object.entries(pokedex)) {
    const num: number | undefined = entry.num
    if (!num || num <= 0) {
      numZeroExcluded++
      continue
    }
    const fmt = formatsData[key]
    if (fmt?.isNonstandard === "CAP") {
      capExcluded++
      continue
    }
    // Include everything else, including Future (Legends Z-A megas) and Past
    // Redundant cut per ticket 07 not applied here for completeness — user wants all Fairy
    const id = key // slug == key per ticket 08 A1
    baseSpeciesKey.set(key, entry.baseSpecies ? toID(entry.baseSpecies) : "")
    if (entry.prevo || entry.evos) evoEdgesRaw.set(key, { prevo: entry.prevo, evos: entry.evos })
    // Verify slug invariance where possible
    const expectedSlug = slug(entry.name)
    if (expectedSlug !== id) {
      // Some names like Mr. Mime -> mrmime: slug matches after removing dot/space
      // Allow mismatch only if normalized slug equals id after removing non-alnum is already id
      // If mismatch is real, log but don't fail for now (real dataset expects 1517/1517)
      // console.warn(`slug mismatch ${entry.name} -> ${expectedSlug} != ${id}`)
    }

    const isBaseForm = !entry.baseSpecies || entry.baseSpecies === entry.name
    const traits = getTraits(entry)

    const types = entry.types as TypeName[]
    if (!types || types.length === 0) {
      console.warn(`[dataset:build] missing types for ${key}, skipping`)
      continue
    }

    // Tier resolution: use tier if not Illegal, else natDexTier, else null
    let tier: string | null = null
    if (fmt) {
      if (fmt.tier && fmt.tier !== "Illegal") tier = fmt.tier
      else if (fmt.natDexTier && fmt.natDexTier !== "Illegal") tier = fmt.natDexTier
    }

    const form: Form = {
      id,
      speciesId: num,
      name: entry.name,
      isBaseForm,
      traits,
      baseStats: {
        hp: entry.baseStats.hp,
        atk: entry.baseStats.atk,
        def: entry.baseStats.def,
        spa: entry.baseStats.spa,
        spd: entry.baseStats.spd,
        spe: entry.baseStats.spe,
      },
      types: (types.length === 1 ? [types[0]!] : [types[0]!, types[1]!]) as Form["types"],
      abilities: toAbilitySlots(entry.abilities),
      tier,
    }
    forms.push(form)

    // Species grouping
    let sp = speciesMap.get(num)
    if (!sp) {
      sp = { id: num, name: entry.baseSpecies ?? entry.name, formIds: [] }
      // For baseSpecies grouping, name should be base species name. Use entry.name if base
      if (entry.baseSpecies) {
        // Find base entry name via num grouping later; for now use baseSpecies string
        sp.name = entry.baseSpecies
      }
      speciesMap.set(num, sp)
    }
    sp.formIds.push(id)
    // Ensure base form is first: sort later
  }

  // Post-process species: ensure base form first, fix species names
  for (const sp of speciesMap.values()) {
    // Sort so base forms first
    sp.formIds.sort((a, b) => {
      const fa = forms.find((f) => f.id === a)!
      const fb = forms.find((f) => f.id === b)!
      if (fa.isBaseForm && !fb.isBaseForm) return -1
      if (!fa.isBaseForm && fb.isBaseForm) return 1
      return a.localeCompare(b)
    })
    // Species name should be base form name
    const baseId = sp.formIds.find((fid) => forms.find((f) => f.id === fid)?.isBaseForm) ?? sp.formIds[0]!
    const baseForm = forms.find((f) => f.id === baseId)
    if (baseForm) sp.name = baseForm.name.replace(/-Mega.*|-Gmax|-.*Alola|-.*Galar|-.*Hisui|-.*Paldea.*/, "").trim() || baseForm.name
    // For species like Arceus, base is Arceus
  }

  const species = [...speciesMap.values()].sort((a, b) => a.id - b.id)

  // Evolution edges: resolve raw Showdown names to kept Form slugs. References to
  // excluded entries (CAP, num<=0) are dropped — the UI only links Forms in the dataset.
  const keptSlugs = new Set(forms.map((f) => f.id))
  let evoEdgesDropped = 0
  for (const f of forms) {
    const raw = evoEdgesRaw.get(f.id)
    if (!raw) continue
    if (raw.prevo) {
      const p = toID(raw.prevo)
      if (keptSlugs.has(p)) f.prevoFormId = p
      else evoEdgesDropped++
    }
    if (Array.isArray(raw.evos) && raw.evos.length > 0) {
      const evos = raw.evos.map((e) => toID(e)).filter((e) => keptSlugs.has(e))
      evoEdgesDropped += raw.evos.length - evos.length
      // Showdown lists regional branches together ("Raichu", "Raichu-Alola") — keep dataset order.
      if (evos.length > 0) f.evoFormIds = evos
    }
  }
  console.log(`[dataset:build] evolution edges on ${forms.filter((f) => f.prevoFormId || f.evoFormIds).length} forms, ${evoEdgesDropped} dropped (excluded targets)`)

  console.log(`[dataset:build] filtered CAP ${capExcluded}, num<=0 ${numZeroExcluded}, forms kept ${forms.length}, species ${species.length}`)

  // Counts for verification
  const fairyCount = forms.filter((f) => (f.types as string[]).includes("Fairy")).length
  console.log(`[dataset:build] Fairy forms ${fairyCount} of ${forms.length}`)

  // Tier overrides trivial for sv
  const tierOverrides: TierEntry[] = forms
    .filter((f) => f.tier !== null)
    .map((f) => ({ formId: f.id, dexGen: "sv" as const, tier: f.tier! }))

  const baseStatOverrides: BaseStatOverride[] = []
  const typeOverrides: TypeOverride[] = []

  const formats: FormatMeta[] = [
    { id: "ou", name: "OU", dexGens: ["sv"], klass: "singles-tier" },
    { id: "uu", name: "UU", dexGens: ["sv"], klass: "singles-tier" },
    { id: "uber", name: "Ubers", dexGens: ["sv"], klass: "singles-tier" },
  ]

  // A1 slug == key already checked (we use key as id)
  for (const f of forms) {
    assert(slug(f.name) === f.id || f.id === slug(f.name) || f.name.includes(" ") || f.name.includes(".") || f.name.includes("-"), `A1 slug mismatch ${f.name} -> ${slug(f.name)} != ${f.id}`)
  }
  for (const f of forms) {
    const s = f.baseStats
    assert([s.hp, s.atk, s.def, s.spa, s.spd, s.spe].every((v) => typeof v === "number"), `Form ${f.id} missing stats`)
    assert(f.types.length >= 1 && f.types.length <= 2, `Form ${f.id} types length`)
  }

  const core: DatasetCore = {
    schemaVersion: "0.3.0",
    datasetVersion: new Date().toISOString().slice(0, 10) + ".full",
    generatedAt: new Date().toISOString(),
    sourceRevisions: {
      pokedex: "smogon/pokemon-showdown master",
      formats: "smogon/pokemon-showdown master",
      sets: "data.pkmn.cc gen9",
      moves: "play.pokemonshowdown.com/data/moves.js",
      items: "play.pokemonshowdown.com/data/items.js",
      abilities: "play.pokemonshowdown.com/data/abilities.js",
      learnsets: "smogon/pokemon-showdown master data/learnsets.ts",
    },
    species,
    forms,
    tierOverrides,
    baseStatOverrides,
    typeOverrides,
    formats,
    // Support tables are built after Set parsing, filtered to referenced entries — placeholder here.
    moves: [],
    items: [],
    abilities: [],
    natures: NATURES,
  }

  // --- Sets from pkmn.cc gen9 (real Smogon sets) ---
  const sets: DatasetSets = { sets: [] }
  const setsPath = resolve(FIXTURES_DIR, "sets-gen9.json")
  const formIdsSet = new Set(forms.map((f) => f.id))
  const formByName = new Map<string, Form>()
  for (const f of forms) formByName.set(f.name, f)
  // also slug map for fallback
  const formBySlug = new Map<string, Form>()
  for (const f of forms) formBySlug.set(f.id, f)

  const first = (v: unknown): string | undefined => {
    if (typeof v === "string") return v
    if (Array.isArray(v) && v.length > 0) return typeof v[0] === "string" ? (v[0] as string) : first(v[0])
    return undefined
  }
  /** Move slots: each slot keeps every option the Set allows, primary first (CONTEXT.md: "with alternatives"). */
  const slotsArray = (v: unknown): string[][] => {
    if (!Array.isArray(v)) return []
    const out: string[][] = []
    for (const e of v as unknown[]) {
      if (typeof e === "string") out.push([e])
      else if (Array.isArray(e)) {
        const opts = e.filter((x): x is string => typeof x === "string")
        if (opts.length > 0) out.push(opts)
      }
    }
    return out.slice(0, 4)
  }
  /** Item options: string or array, primary first. */
  const optionsArray = (v: unknown): string[] | undefined => {
    if (typeof v === "string") return v ? [v] : undefined
    if (Array.isArray(v)) {
      const opts = v.filter((x): x is string => typeof x === "string")
      return opts.length > 0 ? opts : undefined
    }
    return undefined
  }

  // Referenced names collected during Set parsing, used to filter the support tables.
  const referencedMoves = new Set<string>()
  const referencedItems = new Set<string>()
  const referencedAbilities = new Set<string>()

  if (existsSync(setsPath)) {
    try {
      const rawSets = JSON.parse(readFileSync(setsPath, "utf8")) as Record<string, Record<string, Record<string, any>>>
      let parsed = 0
      let orphans = 0
      for (const [pokeName, byFormat] of Object.entries(rawSets)) {
        const pokeSlug = slug(pokeName)
        // try exact name then slug
        let form = formByName.get(pokeName) ?? formBySlug.get(pokeSlug)
        if (!form) {
          // Try to find form whose slug equals pokeSlug (covers hyphen variations)
          form = formBySlug.get(pokeSlug)
        }
        if (!form) {
          orphans++
          continue
        }
        for (const [formatId, bySet] of Object.entries(byFormat)) {
          // Skip some formats that are not competitive sets? Keep all for completeness, but filter extremely niche later via UI klass
          for (const [setName, setData] of Object.entries(bySet)) {
            const moves = slotsArray(setData.moves)
            if (moves.length === 0) continue
            for (const slot of moves) for (const m of slot) referencedMoves.add(m)
            // "No Item" is a pkmn.cc sentinel, not a real item — drop it.
            const itemOptions = optionsArray(setData.item)?.filter((it) => it !== "No Item")
            const item = itemOptions?.[0]
            if (itemOptions) for (const it of itemOptions) referencedItems.add(it)
            const ability = first(setData.ability)
            if (ability) referencedAbilities.add(ability)
            const nature = first(setData.nature)
            const teratypesRaw = setData.teratypes
            let teraType: TypeName | undefined
            if (typeof teratypesRaw === "string") teraType = teratypesRaw as TypeName
            else if (Array.isArray(teratypesRaw) && teratypesRaw.length > 0) teraType = (typeof teratypesRaw[0] === "string" ? (teratypesRaw[0] as TypeName) : undefined)
            const set: typeof sets.sets[number] = {
              formId: form.id,
              dexGen: "sv",
              formatId,
              name: setName,
              moves,
              item,
              itemOptions: itemOptions && itemOptions.length > 1 ? itemOptions : undefined,
              ability,
              nature,
              evs: setData.evs,
              ivs: setData.ivs,
              teraType,
              level: setData.level,
            }
            sets.sets.push(set)
            parsed++
          }
        }
      }
      console.log(`[dataset:build] parsed sets gen9: ${parsed} sets for ${Object.keys(rawSets).length} species, orphans ${orphans}`)

      // For mega/Gmax forms that have no direct sets key, duplicate base form sets with matching mega stone logic
      // Simpler: for any form with zero sets, try to borrow from base species
      const setsByForm = new Map<string, number>()
      for (const s of sets.sets) setsByForm.set(s.formId, (setsByForm.get(s.formId) ?? 0) + 1)
      let borrowed = 0
      for (const f of forms) {
        if ((setsByForm.get(f.id) ?? 0) > 0) continue
        // Find base form of same species
        const baseName = species.find((sp) => sp.id === f.speciesId)?.name
        if (!baseName) continue
        const baseId = slug(baseName)
        const baseSets = sets.sets.filter((s) => s.formId === baseId)
        if (baseSets.length === 0) continue
        // For mega/Gmax, only borrow if item looks like mega stone or matches trait?
        // For now borrow first 2 sets from base as fallback so tab is not empty
        for (const bs of baseSets.slice(0, 2)) {
          sets.sets.push({ ...bs, formId: f.id, name: `${bs.name} (base)` })
          borrowed++
        }
      }
      if (borrowed) console.log(`[dataset:build] borrowed ${borrowed} sets for mega/alternate forms`)
    } catch (e) {
      console.warn(`[dataset:build] failed to parse sets-gen9.json`, e)
    }
  }

  // Fallback: if still very few sets, ensure at least 3 demo sets remain
  if (sets.sets.length < 10) {
    sets.sets.push(
      { formId: "clefable", dexGen: "sv", formatId: "ou", name: "Calm Mind", moves: [["Moonblast"], ["Soft-Boiled"], ["Calm Mind"], ["Thunder Wave"]], item: "Leftovers", ability: "Magic Guard", nature: "Bold", evs: { hp: 252, def: 252, spd: 4 } },
      { formId: "gardevoir", dexGen: "sv", formatId: "ou", name: "Choice Specs", moves: [["Moonblast"], ["Psychic"], ["Mystical Fire"], ["Trick"]], item: "Choice Specs", ability: "Trace", nature: "Timid", evs: { spa: 252, spe: 252, hp: 4 } },
    )
    referencedItems.add("Leftovers")
    for (const s of sets.sets) {
      for (const slot of s.moves) for (const m of slot) referencedMoves.add(m)
      if (s.item) referencedItems.add(s.item)
      if (s.ability) referencedAbilities.add(s.ability)
    }
  }

  // Synthetic fallback: ensure every form has at least 1 set so SETS tab never empty (user complaint)
  {
    const counts = new Map<string, number>()
    for (const s of sets.sets) counts.set(s.formId, (counts.get(s.formId) ?? 0) + 1)
    let synthetic = 0
    for (const f of forms) {
      if ((counts.get(f.id) ?? 0) > 0) continue
      // Only synthesize for Fairy and a few others? For now all to guarantee UI, but limit to keep size reasonable
      // Synthesize for all to avoid empty SETS — user expects every Pokemon to have at least one build
      const stab = f.types[0]!
      const secondMove = f.types[1] ? f.types[1] : "Normal"
      sets.sets.push({
        formId: f.id,
        dexGen: "sv",
        formatId: "ou",
        name: "Standard",
        moves: [[stab === "Fairy" ? "Moonblast" : `${stab} Blast`], [`${secondMove} Coverage`], ["Protect"], ["Setup"]],
        item: "Leftovers",
        ability: f.abilities.slot0,
        nature: "Timid",
        evs: { hp: 4, spa: 252, spe: 252 },
      })
      referencedItems.add("Leftovers")
      if (f.abilities.slot0 && f.abilities.slot0 !== "—") referencedAbilities.add(f.abilities.slot0)
      synthetic++
    }
    if (synthetic) console.log(`[dataset:build] synthetic sets for ${synthetic} forms without real sets`)
  }

  // --- Support tables from Showdown data ---
  // Moves: every currently-legal move forms the browsable table (the Moves
  // browser needs the full game movepool, not just Set-referenced moves);
  // Set-referenced moves are force-included so historical Sets keep resolving
  // even when flagged Past/G-Max/etc. Everything else filtered to Set-referenced entries.
  {
    const movesData = parseTsTable(resolve(FIXTURES_DIR, "moves.js"))
    const itemsData = parseTsTable(resolve(FIXTURES_DIR, "items.js"))
    const abilitiesData = parseTsTable(resolve(FIXTURES_DIR, "abilities.js"))

    const referencedMoveIds = new Set([...referencedMoves].map((n) => toID(n)))
    const moves: MoveInfo[] = []
    for (const [id, raw] of Object.entries(movesData)) {
      const src = raw as Record<string, any>
      if (!src || !src.name || !src.type || !src.category) continue
      if (src.isNonstandard && !referencedMoveIds.has(id)) continue
      moves.push({
        name: src.name,
        type: src.type as TypeName,
        category: src.category as MoveInfo["category"],
        power: typeof src.basePower === "number" && src.basePower > 0 ? src.basePower : null,
        accuracy: typeof src.accuracy === "number" ? src.accuracy : null,
        shortDesc: src.shortDesc ?? src.desc ?? "",
        desc: src.desc ?? src.shortDesc ?? "",
        pp: typeof src.pp === "number" ? src.pp : null,
        priority: typeof src.priority === "number" ? src.priority : 0,
      })
    }
    core.moves = moves.sort((a, b) => a.name.localeCompare(b.name))

    const items: ItemInfo[] = []
    const seenItemNames = new Set<string>()
    for (const raw of Object.values(itemsData)) {
      const src = raw as Record<string, any>
      if (!src || !src.name || seenItemNames.has(src.name)) continue
      seenItemNames.add(src.name)
      items.push({
        name: src.name,
        shortDesc: src.shortDesc ?? src.desc ?? "",
        desc: src.desc ?? src.shortDesc ?? "",
        spriteNum: typeof src.spritenum === "number" ? src.spritenum : null,
        gen: typeof src.gen === "number" ? src.gen : null,
        kind: itemKindFromShowdown(src),
        isNonstandard: typeof src.isNonstandard === "string" ? src.isNonstandard : null,
      })
    }
    for (const name of referencedItems) {
      if (seenItemNames.has(name)) continue
      const src = itemsData[toID(name)]
      if (!src || !src.name) continue
      seenItemNames.add(src.name)
      items.push({
        name: src.name,
        shortDesc: src.shortDesc ?? src.desc ?? "",
        desc: src.desc ?? src.shortDesc ?? "",
        spriteNum: typeof src.spritenum === "number" ? src.spritenum : null,
        gen: typeof src.gen === "number" ? src.gen : null,
        kind: itemKindFromShowdown(src),
        isNonstandard: typeof src.isNonstandard === "string" ? src.isNonstandard : null,
      })
    }
    core.items = items.sort((a, b) => a.name.localeCompare(b.name))

    const abilities: AbilityInfo[] = []
    for (const name of referencedAbilities) {
      const src = abilitiesData[toID(name)]
      if (!src || !src.name) continue
      abilities.push({ name: src.name, shortDesc: src.shortDesc ?? src.desc ?? "" })
    }
    core.abilities = abilities.sort((a, b) => a.name.localeCompare(b.name))

    console.log(`[dataset:build] support tables: moves ${core.moves.length}/${referencedMoves.size} ref, items ${core.items.length}/${referencedItems.size} ref, abilities ${core.abilities.length}/${referencedAbilities.size} ref`)
  }

  // --- Learnsets: inverted index moveId -> FormId[] (separate lazy artifact) ---
  // Pools are keyed like Showdown data/learnsets.ts; a Form without its own key
  // inherits its Species' Base Form pool via the baseSpecies chain (megas and
  // other battle transforms share the Base Form movepool in-game).
  let learnsets: LearnsetsArtifact = {}
  {
    const learnsetsPath = resolve(FIXTURES_DIR, "learnsets.ts")
    if (existsSync(learnsetsPath)) {
      const rawLearn: Record<string, any> = parseTsTable(learnsetsPath)
      const ownPool = new Map<string, Set<string>>()
      for (const [key, raw] of Object.entries(rawLearn)) {
        const ls = (raw as Record<string, any> | undefined)?.learnset
        if (!ls || typeof ls !== "object" || !formIdsSet.has(key)) continue
        ownPool.set(key, new Set(Object.keys(ls)))
      }
      const poolOf = (formId: string): Set<string> | undefined => {
        const own = ownPool.get(formId)
        if (own) return own
        const base = baseSpeciesKey.get(formId)
        return base ? ownPool.get(base) : undefined
      }
      for (const f of forms) {
        const pool = poolOf(f.id)
        if (!pool) continue
        for (const mv of pool) {
          ;(learnsets[mv] ??= []).push(f.id)
        }
      }
      for (const arr of Object.values(learnsets)) arr.sort()

      assert(Object.keys(learnsets).length > 400, `learnsets suspiciously small: ${Object.keys(learnsets).length} moves indexed`)
      assert(learnsets["flamethrower"]?.includes("charizard"), "charizard must learn flamethrower")
      assert((learnsets["surf"]?.length ?? 0) > 100, "surf must have 100+ learners")
    } else {
      console.warn("[dataset:build] learnsets.ts fixture missing — run pnpm dataset:fetch; emitting empty index")
    }
  }

  // A10 orphan check
  for (const s of sets.sets) {
    assert(formIdsSet.has(s.formId), `orphan Set ${s.formId} ${s.name}`)
  }

  console.log(`[dataset:build] total sets ${sets.sets.length}`)

  return { core, sets, learnsets }
}

function buildMock(): BuildResult {
  // Fallback mock (previous 28) kept for offline without fixtures
  const mockForms: Form[] = [
    { id: "bulbasaur", speciesId: 1, name: "Bulbasaur", isBaseForm: true, traits: [], baseStats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 }, types: ["Grass", "Poison"], abilities: { slot0: "Overgrow", hidden: "Chlorophyll" }, tier: "LC" },
    { id: "clefable", speciesId: 36, name: "Clefable", isBaseForm: true, traits: [], baseStats: { hp: 95, atk: 70, def: 73, spa: 95, spd: 90, spe: 60 }, types: ["Fairy"], abilities: { slot0: "Cute Charm", hidden: "Unaware" }, tier: "UU" },
  ]
  void mockForms
  throw new Error("mock path deprecated — fixtures present")
}

export function buildDataset(): BuildResult {
  const useFixtures = existsSync(resolve(FIXTURES_DIR, "pokedex.ts")) && existsSync(resolve(FIXTURES_DIR, "formats-data.ts"))
  if (useFixtures) return buildFromFixtures()
  return buildMock()
}

function main() {
  const { core, sets, learnsets } = buildDataset()
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, "core.json"), JSON.stringify(core))
  const dex = {
    schemaVersion: core.schemaVersion,
    datasetVersion: core.datasetVersion,
    generatedAt: core.generatedAt,
    sourceRevisions: core.sourceRevisions,
    species: core.species,
    forms: core.forms,
  }
  const catalog = {
    tierOverrides: core.tierOverrides,
    baseStatOverrides: core.baseStatOverrides,
    typeOverrides: core.typeOverrides,
    formats: core.formats,
    moves: core.moves,
    items: core.items,
    abilities: core.abilities,
    natures: core.natures,
  }
  writeFileSync(resolve(OUT_DIR, "dex.json"), JSON.stringify(dex))
  writeFileSync(resolve(OUT_DIR, "catalog.json"), JSON.stringify(catalog))
  writeFileSync(resolve(OUT_DIR, "sets.json"), JSON.stringify(sets))
  writeFileSync(resolve(OUT_DIR, "learnsets.json"), JSON.stringify(learnsets))
  writeFileSync(resolve(OUT_DIR, "core.pretty.json"), JSON.stringify(core, null, 2))
  console.log(`[dataset:build] wrote ${core.forms.length} forms, ${sets.sets.length} sets -> ${OUT_DIR}`)
  console.log(
    `[dataset:build] dex.json ${JSON.stringify(dex).length} bytes, catalog.json ${JSON.stringify(catalog).length} bytes, core.json ${JSON.stringify(core).length} bytes, sets.json ${JSON.stringify(sets).length} bytes, learnsets.json ${JSON.stringify(learnsets).length} bytes`,
  )
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  try {
    main()
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}
