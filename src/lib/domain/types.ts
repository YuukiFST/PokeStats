/**
 * Domain model per CONTEXT.md and tickets 08 (modelo-de-dominio) + 07 (escopo dataset).
 * File is canonical glossary implementation: file_path:line_number references in UI strings must match these spellings.
 */

// ---------- identity ----------
export type SpeciesId = number // 1..1025

/** Canonical slug: lowercase, unaccented, alphanumeric only. `charizardmegax`. */
export type FormId = string

export type DexGeneration = "rb" | "gs" | "rs" | "dp" | "bw" | "xy" | "sm" | "ss" | "sv"

export type FormTrait = "mega" | "gmax" | "primal" | "regional" | "battle-only"

export type TypeName =
  | "Normal"
  | "Fire"
  | "Water"
  | "Electric"
  | "Grass"
  | "Ice"
  | "Fighting"
  | "Poison"
  | "Ground"
  | "Flying"
  | "Psychic"
  | "Bug"
  | "Rock"
  | "Ghost"
  | "Dragon"
  | "Dark"
  | "Steel"
  | "Fairy"

// ---------- collected data ----------
export interface BaseStatSpread {
  hp: number
  atk: number
  def: number
  spa: number
  spd: number
  spe: number
}

export interface AbilitySlots {
  slot0: string
  slot1?: string
  hidden?: string
  special?: string
}

export interface Species {
  id: SpeciesId
  name: string
  /** Every Form of this Species. Base Form is always first (ticket 08). */
  formIds: FormId[]
}

export interface Form {
  id: FormId
  speciesId: SpeciesId
  name: string
  isBaseForm: boolean
  /** May be empty — ordinary alternate Form carries no Trait (ticket 08). */
  traits: FormTrait[]
  /** Canonical sv + Legends Z-A Megas (ticket 07). */
  baseStats: BaseStatSpread
  types: [TypeName] | [TypeName, TypeName]
  abilities: AbilitySlots
  /** Canonical sv Tier. Null for Z-A megas not in champions (ticket 07). */
  tier: string | null
  /** Previous evolution stage among kept Forms (Showdown `prevo`). Absent on Base-stage Forms. */
  prevoFormId?: FormId
  /** Next evolution stages among kept Forms (Showdown `evos`). Absent on Forms that do not evolve. */
  evoFormIds?: FormId[]
}

export interface TierEntry {
  formId: FormId
  dexGen: DexGeneration
  tier: string
}

export interface BaseStatOverride {
  formId: FormId
  dexGen: DexGeneration
  stats: BaseStatSpread
}

export interface TypeOverride {
  formId: FormId
  dexGen: DexGeneration
  types: [TypeName] | [TypeName, TypeName]
}

// ---------- competitive ----------
export type FormatId = string

export interface FormatMeta {
  id: FormatId
  name: string
  dexGens: DexGeneration[]
  /** Curated class per ticket 09: singles-tier | doubles | vgc | other-metagame | special/retro */
  klass: "singles-tier" | "doubles" | "vgc" | "other-metagame" | "special/retro"
}

export type MoveCategory = "Physical" | "Special" | "Status"

/** Move row resolved from Showdown data/moves.ts. Browsable table = every currently-legal move; Set-referenced moves are force-included. */
export interface MoveInfo {
  name: string
  type: TypeName
  category: MoveCategory
  /** null = variable or N/A (Showdown basePower 0). */
  power: number | null
  /** Percent 1..100; null = never misses (Showdown accuracy true). */
  accuracy: number | null
  /** English effect summary from Showdown shortDesc — source language, like Smogon. */
  shortDesc: string
  /** Long English effect text (Showdown desc); falls back to shortDesc at build. */
  desc: string
  /** Base PP; null when unknown. */
  pp: number | null
  /** Priority bracket (typical -7..+7). */
  priority: number
}

/**
 * Lazy artifact public/dataset/learnsets.json: inverted index moveId -> FormIds that can learn it.
 * Built from Showdown data/learnsets.ts; a Form without its own pool inherits the Species' Base Form pool.
 */
export interface LearnsetsArtifact {
  [moveId: string]: FormId[]
}

export type ItemKind = "mega" | "zcrystal" | "berry" | "choice" | "plate" | "memory" | "drive" | "utility"

export interface ItemInfo {
  name: string
  shortDesc: string
  /** Long English effect text (Showdown desc); falls back to shortDesc at build. */
  desc: string
  /** Position index in the Showdown itemicons-sheet.png (16 columns × 24px cells). null = no icon. */
  spriteNum: number | null
  gen: number | null
  kind: ItemKind
  /** Showdown isNonstandard flag, or null when current. */
  isNonstandard: string | null
}

export interface AbilityInfo {
  name: string
  shortDesc: string
}

export type StatKey = keyof BaseStatSpread

/** One of the 25 fixed natures; plus/minus null for Neutral natures. */
export interface NatureInfo {
  name: string
  plus: StatKey | null
  minus: StatKey | null
}

export interface Set {
  /** Natural key (Form, DexGeneration, Format, name) — no synthetic id unless Team references Set (ticket 08 risk). */
  formId: FormId
  dexGen: DexGeneration
  formatId: FormatId
  name: string
  /** Up to 4 slots; each slot is the options the Set allows, primary first (CONTEXT.md: "with alternatives"). */
  moves: string[][]
  item?: string
  /** Alternative items the Set allows, primary first. */
  itemOptions?: string[]
  ability?: string
  nature?: string
  evs?: Partial<BaseStatSpread>
  ivs?: Partial<BaseStatSpread>
  teraType?: TypeName
  level?: number
}

// ---------- team (ticket 13 pending, but persistence needs version) ----------
export interface TeamSlot {
  formId: FormId
  /** Optional Set reference — if null, raw Form */
  setKey?: { dexGen: DexGeneration; formatId: FormatId; name: string }
}

export interface Team {
  id: string
  name: string
  slots: (TeamSlot | null)[] // length 6, null = empty
  createdWithDatasetVersion: string
  /** Matchup simulator: opponent FormIds. Optional — Teams persisted before this field lack it. */
  opponents?: FormId[]
  /** Membros Sugeridos cards the user pinned; survive filter changes until unpinned or added. */
  pinnedSuggestions?: FormId[]
  /** Members the user locked against swap suggestions (favorites); plans and swaps route around them. */
  protectedMembers?: FormId[]
}

// ---------- dataset artifact (ticket 08: core + sets, JSON minified) ----------
/** Forms + species only — enough for the Dex first paint. */
export interface DatasetDex {
  schemaVersion: string
  datasetVersion: string
  generatedAt: string
  sourceRevisions: Record<string, string>
  species: Species[]
  forms: Form[]
}

/** Moves/items/abilities and the rest of core, loaded after the Dex is on screen. */
export interface DatasetCatalog {
  tierOverrides: TierEntry[]
  baseStatOverrides: BaseStatOverride[]
  typeOverrides: TypeOverride[]
  formats: FormatMeta[]
  /** Moves: legal + Set-referenced. Items: full Showdown held-item table. Abilities: Set-referenced. */
  moves: MoveInfo[]
  items: ItemInfo[]
  abilities: AbilityInfo[]
  natures: NatureInfo[]
}

export type DatasetCore = DatasetDex & DatasetCatalog

export interface DatasetSets {
  sets: Set[]
}
