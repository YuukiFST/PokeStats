import { describe, expect, it } from "vitest"
import { indexCore, withExtras } from "./load"
import type { DatasetCore } from "@/lib/domain/types"

const core: DatasetCore = {
  schemaVersion: "1",
  datasetVersion: "test",
  generatedAt: "",
  sourceRevisions: {},
  species: [{ id: 6, name: "Charizard", formIds: ["charizard", "charizardmegax"] }],
  forms: [
    {
      id: "charizard",
      speciesId: 6,
      name: "Charizard",
      isBaseForm: true,
      traits: [],
      baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
      types: ["Fire", "Flying"],
      abilities: { slot0: "Blaze" },
      tier: "OU",
    },
    {
      id: "charizardmegax",
      speciesId: 6,
      name: "Charizard-Mega-X",
      isBaseForm: false,
      traits: ["mega"],
      baseStats: { hp: 78, atk: 130, def: 111, spa: 130, spd: 85, spe: 100 },
      types: ["Fire", "Dragon"],
      abilities: { slot0: "Tough Claws" },
      tier: "Ubers",
    },
  ],
  tierOverrides: [],
  baseStatOverrides: [],
  typeOverrides: [],
  formats: [],
  moves: [
    {
      name: "Flamethrower",
      type: "Fire",
      category: "Special",
      power: 90,
      accuracy: 100,
      shortDesc: "",
      desc: "",
      pp: 15,
      priority: 0,
    },
  ],
  items: [{ name: "Leftovers", shortDesc: "", desc: "", spriteNum: null, gen: 2, kind: "utility", isNonstandard: null }],
  abilities: [{ name: "Blaze", shortDesc: "" }],
  natures: [{ name: "Modest", plus: "spa", minus: "atk" }],
}

describe("indexCore / withExtras", () => {
  it("builds formsById and enrichment BST as the sum of six stats", () => {
    const indexed = indexCore(core)
    expect(indexed.formsById.get("charizard")?.name).toBe("Charizard")
    expect(indexed.formsById.get("charizardmegax")?.isBaseForm).toBe(false)
    expect(indexed.enrichment.get("charizard")?.bst).toBe(78 + 84 + 78 + 109 + 85 + 100)
  })

  it("withExtras extrasReady false keeps empty sets", () => {
    const indexed = indexCore(core)
    const staged = withExtras(indexed, { sets: [] }, {}, false)
    expect(staged.extrasReady).toBe(false)
    expect(staged.sets.sets).toEqual([])
    expect(staged.learnsets).toEqual({})
  })

  it("indexes items by slug id", () => {
    const indexed = indexCore(core)
    expect(indexed.itemsById.get("leftovers")?.name).toBe("Leftovers")
  })

  it("withExtras extrasReady true reuses the same formsById map", () => {
    const indexed = indexCore(core)
    const full = withExtras(
      indexed,
      { sets: [{ formId: "charizard", dexGen: "sv", formatId: "gen9ou", name: "Standard", moves: [["Flamethrower"]] }] },
      { flamethrower: ["charizard"] },
      true,
    )
    expect(full.extrasReady).toBe(true)
    expect(full.formsById).toBe(indexed.formsById)
    expect(full.sets.sets).toHaveLength(1)
  })
})
