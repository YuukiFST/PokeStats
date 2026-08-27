/**
 * Shared test fixtures for the domain modules: minimal builders plus the golden
 * Smart Counters scenario (frail no-Set bird vs bulky Levitate Set carrier vs a
 * Ground opponent with Rock coverage). Test-only — never imported by app code.
 */
import type { Form, MoveInfo, NatureInfo, Set } from "./types"

export function makeMove(over: Partial<MoveInfo> & Pick<MoveInfo, "name" | "type" | "category">): MoveInfo {
  return { power: 80, accuracy: 100, shortDesc: "", desc: "", pp: 10, priority: 0, ...over }
}

export function makeForm(over: Partial<Form> & Pick<Form, "id" | "types">): Form {
  return {
    speciesId: 1,
    name: over.id,
    isBaseForm: true,
    traits: [],
    baseStats: { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
    abilities: { slot0: "Pressure" },
    tier: null,
    ...over,
  }
}

export function makeSet(over: Partial<Set> & Pick<Set, "formId" | "moves">): Set {
  return { dexGen: "sv", formatId: "gen9ou", name: "Standard", ...over }
}

export const NATURES: Record<string, NatureInfo> = {
  Serious: { name: "Serious", plus: null, minus: null },
  Adamant: { name: "Adamant", plus: "atk", minus: "spa" },
  Modest: { name: "Modest", plus: "spa", minus: "atk" },
}

/** Golden scenario: Ground opponent whose real Sets click Earthquake + Stone Edge. */
export const GOLDEN_MOVES: Record<string, MoveInfo> = {
  Earthquake: makeMove({ name: "Earthquake", type: "Ground", category: "Physical", power: 100 }),
  "Stone Edge": makeMove({ name: "Stone Edge", type: "Rock", category: "Physical", power: 100 }),
  "Swords Dance": makeMove({ name: "Swords Dance", type: "Normal", category: "Status", power: null }),
  "Hydro Pump": makeMove({ name: "Hydro Pump", type: "Water", category: "Special", power: 110 }),
  Thunderbolt: makeMove({ name: "Thunderbolt", type: "Electric", category: "Special", power: 90 }),
  "Will-O-Wisp": makeMove({ name: "Will-O-Wisp", type: "Fire", category: "Status", power: null }),
}

export const OPP = makeForm({
  id: "sandlord",
  types: ["Ground"],
  baseStats: { hp: 80, atk: 110, def: 90, spa: 60, spd: 70, spe: 90 },
  abilities: { slot0: "Sand Rush" },
})

export const OPP_SET = makeSet({
  formId: "sandlord",
  moves: [["Earthquake"], ["Stone Edge"], ["Swords Dance"]],
  ability: "Sand Rush",
  evs: { atk: 252, spe: 252 },
  nature: "Adamant",
})

/** Type-math darling: immune to Ground, Water hits back SE — but 4x Rock-weak and frail. */
export const FRAILBIRD = makeForm({
  id: "frailbird",
  types: ["Water", "Flying"],
  baseStats: { hp: 70, atk: 85, def: 55, spa: 85, spd: 95, spe: 85 },
  abilities: { slot0: "Hydration" },
})

/** Real counter: Levitate blanks Earthquake, bulk survives Stone Edge, Hydro Pump OHKOs back. */
export const BULKWORM = makeForm({
  id: "bulkworm",
  types: ["Electric", "Water"],
  baseStats: { hp: 90, atk: 65, def: 90, spa: 105, spd: 95, spe: 70 },
  abilities: { slot0: "Levitate" },
})

export const BULKWORM_SET = makeSet({
  formId: "bulkworm",
  moves: [["Hydro Pump"], ["Thunderbolt"], ["Will-O-Wisp"]],
  ability: "Levitate",
  evs: { hp: 252, spa: 252 },
  nature: "Modest",
})
