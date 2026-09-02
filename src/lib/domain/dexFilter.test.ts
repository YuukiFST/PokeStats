import { describe, expect, it } from "vitest"
import { collapseSpecies, formMatchesSelectedTypes, sortForms } from "./dexFilter"
import type { Form } from "./types"

describe("formMatchesSelectedTypes", () => {
  it("matches every Form when no types are selected", () => {
    expect(formMatchesSelectedTypes(["Dark"], new Set())).toBe(true)
  })

  it("matches a Form that has the single selected type", () => {
    expect(formMatchesSelectedTypes(["Fire", "Fighting"], new Set(["Fighting"]))).toBe(true)
  })

  it("rejects a Form that lacks the single selected type", () => {
    expect(formMatchesSelectedTypes(["Dark"], new Set(["Fighting"]))).toBe(false)
  })

  it("requires every selected type on the Form, not any of them", () => {
    const both = new Set(["Dark", "Fighting"])
    expect(formMatchesSelectedTypes(["Dark"], both)).toBe(false)
    expect(formMatchesSelectedTypes(["Fighting", "Ghost"], both)).toBe(false)
    expect(formMatchesSelectedTypes(["Fire", "Fighting"], both)).toBe(false)
    expect(formMatchesSelectedTypes(["Dark", "Fighting"], both)).toBe(true)
  })
})

function form(partial: Partial<Form> & Pick<Form, "id" | "speciesId" | "name" | "baseStats">): Form {
  return {
    isBaseForm: true,
    traits: [],
    types: ["Normal"],
    abilities: { slot0: "—" },
    tier: "OU",
    ...partial,
  }
}

describe("sortForms", () => {
  const slow = form({ id: "a", speciesId: 1, name: "Abra", baseStats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 10 } })
  const fast = form({ id: "z", speciesId: 2, name: "Zapdos", baseStats: { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 90 } })

  it("sorts by name ascending and descending", () => {
    expect(sortForms([fast, slow], "name", "asc").map((f) => f.name)).toEqual(["Abra", "Zapdos"])
    expect(sortForms([fast, slow], "name", "desc").map((f) => f.name)).toEqual(["Zapdos", "Abra"])
  })

  it("sorts by spe descending with the fastest first", () => {
    expect(sortForms([slow, fast], "spe", "desc")[0]!.id).toBe("z")
  })

  it("sorts by bst using the six-stat sum", () => {
    expect(sortForms([slow, fast], "bst", "desc")[0]!.id).toBe("z")
    expect(sortForms([slow, fast], "bst", "asc")[0]!.id).toBe("a")
  })
})

describe("collapseSpecies", () => {
  const stats = { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 }
  const base = form({ id: "base", speciesId: 6, name: "Charizard", isBaseForm: true, baseStats: stats })
  const megaSame = form({ id: "mega", speciesId: 6, name: "Charizard-Mega", isBaseForm: false, baseStats: stats })
  const megaDiff = form({
    id: "megax",
    speciesId: 6,
    name: "Charizard-Mega-X",
    isBaseForm: false,
    baseStats: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 },
  })
  const other = form({ id: "pikachu", speciesId: 25, name: "Pikachu", baseStats: stats })

  it("keeps the base Form when two Forms of one Species share a BST", () => {
    expect(collapseSpecies([megaSame, base]).map((f) => f.id)).toEqual(["base"])
  })

  it("keeps both Forms when BST differs", () => {
    expect(collapseSpecies([base, megaDiff]).map((f) => f.id)).toEqual(["base", "megax"])
  })

  it("keeps a single-Form Species and preserves input order", () => {
    expect(collapseSpecies([other, base]).map((f) => f.id)).toEqual(["pikachu", "base"])
  })
})
